from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import os
import json
import base64
import hashlib

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
import httpx
from bs4 import BeautifulSoup
from cryptography.fernet import Fernet
from urllib.parse import urlparse
import ipaddress
from bson import ObjectId

from app.core.auth import require_admin
from app.core.config import settings
from app.db.mongo import get_db
from app.services.rag_service import (
    upsert_document,
    query_similar,
)
from app.services.telemetry import log_event
from app.repositories.chat_repo import get_conversation
from app.services.memory_service import update_conversation_summary

router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)], tags=["admin"])


@router.get("/health")
async def admin_health():
    db = get_db()
    ok_db = False
    try:
        await db.command("ping")
        ok_db = True
    except Exception:
        ok_db = False
    return {
        "backend": "online",
        "mongodb": ok_db,
        "gemini_key": bool(settings.GEMINI_API_KEY),
        "rag_collection": settings.RAG_COLLECTION,
        "vector_index": settings.RAG_VECTOR_INDEX,
    }


# ---------------- KB Stats ----------------
@router.get("/kb/stats")
async def kb_stats():
    """Return knowledge base stats: total docs, new docs today/this week."""
    db = get_db()
    coll = db[settings.RAG_COLLECTION]
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week = today - timedelta(days=7)

    total_docs = 0
    docs_today = 0
    docs_week = 0
    try:
        pipeline = [
            {"$match": {"metadata.doc_id": {"$exists": True}, "metadata.ingested_at": {"$exists": True}}},
            {"$group": {"_id": "$metadata.doc_id", "first_ing": {"$min": "$metadata.ingested_at"}}},
        ]
        firsts: List[Dict[str, Any]] = []
        async for d in coll.aggregate(pipeline):
            firsts.append(d)
        total_docs = len(firsts)
        for d in firsts:
            fi = d.get("first_ing")
            if not fi:
                continue
            if fi >= today:
                docs_today += 1
            if fi >= week:
                docs_week += 1
    except Exception:
        pass

    return {"total_docs": total_docs, "docs_today": docs_today, "docs_week": docs_week}


# ---------------- Knowledge Base ----------------
@router.get("/docs")
async def list_documents(limit: int = Query(100, ge=1, le=1000), skip: int = Query(0, ge=0)):
    """Aggregate RAG chunks by doc_id to present document-level view."""
    db = get_db()
    coll = db[settings.RAG_COLLECTION]
    pipeline = [
        {"$match": {"metadata.doc_id": {"$exists": True}}},
        {
            "$group": {
                "_id": "$metadata.doc_id",
                "filename": {"$first": "$metadata.filename"},
                "source": {"$first": "$metadata.source"},
                "first_ingested": {"$min": "$metadata.ingested_at"},
                "last_ingested": {"$max": "$metadata.ingested_at"},
                "chunks": {"$sum": 1},
                "chars": {"$sum": {"$strLenCP": "$text"}},
            }
        },
        {"$sort": {"last_ingested": -1}},
        {"$skip": skip},
        {"$limit": limit},
    ]
    items: List[Dict[str, Any]] = []
    try:
        async for d in coll.aggregate(pipeline):
            items.append(
                {
                    "doc_id": d.get("_id"),
                    "name": d.get("filename") or d.get("_id"),
                    "type": d.get("source") or "unknown",
                    "date_added": d.get("first_ingested"),
                    "updated_at": d.get("last_ingested"),
                    "chunks": d.get("chunks", 0),
                    "word_count": int((d.get("chars", 0) or 0) / 4),
                    "status": "Indexed",
                }
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Aggregation failed: {e}")
    return {"items": items}


@router.delete("/docs/{doc_id}")
async def delete_document(doc_id: str):
    db = get_db()
    coll = db[settings.RAG_COLLECTION]
    result = await coll.delete_many({"metadata.doc_id": doc_id})
    await log_event("kb_delete", {"doc_id": doc_id, "deleted_chunks": result.deleted_count})
    return {"ok": True, "deleted_chunks": result.deleted_count}


@router.get("/docs/search")
async def search_documents(query: str, k: int = Query(5, ge=1, le=20)):
    hits = await query_similar(query, k=k)
    return {"hits": hits}


@router.post("/crawl")
async def crawl_website(urls: List[str]):
    """Fetch provided URLs, extract text, chunk via RAG upsert.
    Metadata: source=web, url, doc_id=sha256(url) (stable), filename=page title.
    """
    if not urls:
        raise HTTPException(status_code=400, detail="Provide at least one URL")
    # Cap number of URLs to avoid abuse
    if len(urls) > 20:
        raise HTTPException(status_code=400, detail="Too many URLs (max 20)")

    async def fetch_text(url: str) -> Dict[str, Any]:
        title = url
        text = ""
        try:
            # Basic SSRF guards: allow only http/https and block private IP literals
            parsed = urlparse(url)
            if parsed.scheme not in {"http", "https"}:
                return {"url": url, "error": "Invalid scheme", "chunks": 0}
            host = parsed.hostname or ""
            # If host is an IP literal, reject private/reserved ranges
            try:
                ip = ipaddress.ip_address(host)
                if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                    return {"url": url, "error": "Blocked host", "chunks": 0}
            except ValueError:
                # not an IP literal; allow domain (note: DNS-based SSRF not fully mitigated here)
                pass

            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                r = await client.get(url)
                r.raise_for_status()
                html = r.text
                soup = BeautifulSoup(html, "html.parser")
                if soup.title and soup.title.string:
                    title = soup.title.string.strip()
                # Remove script/style
                for t in soup(["script", "style", "noscript"]):
                    t.extract()
                text = (soup.get_text(" ") or "").strip()
        except Exception as e:
            return {"url": url, "error": str(e), "chunks": 0}

        # Basic chunking: reuse upsert_document for each chunk via simple window
        CHUNK = 1000
        OVERLAP = 200
        n = len(text)
        start = 0
        chunks = 0
        from hashlib import sha256

        doc_id = sha256(url.encode("utf-8")).hexdigest()
        while start < n:
            end = min(n, start + CHUNK)
            chunk_text = text[start:end]
            meta = {
                "source": "web",
                "url": url,
                "filename": title or url,
                "doc_id": doc_id,
                "ingested_at": datetime.utcnow(),
            }
            try:
                await upsert_document(text=chunk_text, metadata=meta, id=None)
                chunks += 1
            except Exception:
                pass
            if end >= n:
                break
            start = max(end - OVERLAP, 0)
        return {"url": url, "title": title, "chunks": chunks, "doc_id": doc_id}

    results: List[Dict[str, Any]] = []
    for u in urls:
        results.append(await fetch_text(u))

    await log_event("kb_crawl", {"urls": len(urls), "total_chunks": sum(r.get("chunks", 0) for r in results)})
    return {"results": results}


# ---------------- Memory System ----------------
@router.get("/memories")
async def list_memories(user_key: Optional[str] = None, limit: int = Query(100, ge=1, le=1000)):
    db = get_db()
    out: Dict[str, Any] = {"profiles": [], "summaries": []}
    q = {"user_key": user_key} if user_key else {}
    try:
        # Profiles
        cursor = db.mem_profiles.find(q).limit(limit)
        async for d in cursor:
            out["profiles"].append({
                "user_key": d.get("user_key"),
                "notes": d.get("notes", ""),
                "updated_at": d.get("updated_at"),
            })
        # Summaries
        cursor = db.mem_summaries.find(q).sort("updated_at", -1).limit(limit)
        async for d in cursor:
            out["summaries"].append({
                "conversation_id": str(d.get("conversation_id")),
                "user_key": d.get("user_key"),
                "summary": d.get("summary", ""),
                "updated_at": d.get("updated_at"),
            })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list memories: {e}")
    return out


@router.delete("/memories/summary/{conversation_id}")
async def delete_summary(conversation_id: str):
    db = get_db()
    result = await db.mem_summaries.delete_one({"conversation_id": conversation_id})
    return {"ok": True, "deleted": result.deleted_count}


@router.delete("/memories/profile/{user_key}")
async def delete_profile(user_key: str):
    db = get_db()
    result = await db.mem_profiles.delete_one({"user_key": user_key})
    return {"ok": True, "deleted": result.deleted_count}


@router.post("/memories/export")
async def export_memories(user_key: Optional[str] = None):
    data = await list_memories(user_key=user_key)
    # Return as JSON for now; frontend can generate PDF if needed
    return {"exported_at": datetime.utcnow(), **data}


# ---------------- Chats ----------------
@router.get("/chats")
async def list_chats(user_key: Optional[str] = None, days: int = Query(30, ge=1, le=365)):
    db = get_db()
    since = datetime.utcnow() - timedelta(days=days)
    q: Dict[str, Any] = {"deleted_at": {"$exists": False}, "updated_at": {"$gte": since}}
    if user_key:
        q["user_key"] = user_key
    items: List[Dict[str, Any]] = []
    try:
        cursor = db.conversations.find(q, projection={"title": 1, "updated_at": 1, "user_key": 1}).sort("updated_at", -1)
        async for d in cursor:
            items.append({
                "id": str(d.get("_id")),
                "title": d.get("title", "Untitled"),
                "updated_at": d.get("updated_at"),
                "user_key": d.get("user_key"),
            })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list chats: {e}")
    return {"items": items}


@router.get("/chats/{conversation_id}")
async def chat_detail(conversation_id: str):
    conv, msgs = await get_conversation(conversation_id)
    return {"conversation": conv, "messages": msgs}


@router.post("/chats/{conversation_id}/feedback")
async def chat_feedback(conversation_id: str, rating: Optional[int] = None, comment: Optional[str] = None):
    await log_event("feedback", {"conversation_id": conversation_id, "rating": rating, "comment": comment})
    return {"ok": True}


# ---------------- Analytics ----------------
@router.get("/analytics")
async def analytics(days: int = Query(30, ge=1, le=365)):
    db = get_db()
    since = datetime.utcnow() - timedelta(days=days)
    # Chats per day from conversations.updated_at
    chats_per_day: List[Dict[str, Any]] = []
    try:
        pipeline = [
            {"$match": {"updated_at": {"$gte": since}}},
            {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$updated_at"}}, "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
        ]
        async for d in db.conversations.aggregate(pipeline):
            chats_per_day.append({"date": d.get("_id"), "count": d.get("count", 0)})
    except Exception:
        pass

    # Topic distribution (simple heuristic via keywords on latest assistant message - placeholder)
    topic_counts: Dict[str, int] = {}
    try:
        # naive: sample recent messages
        cursor = db.messages.find({}).sort("created_at", -1).limit(1000)
        async for m in cursor:
            txt = (m.get("content") or "").lower()
            for key, label in [
                ("website", "Website"),
                ("app", "App"),
                ("marketing", "Marketing"),
                ("hr", "HR"),
                ("invoice", "Invoice"),
            ]:
                if key in txt:
                    topic_counts[label] = topic_counts.get(label, 0) + 1
    except Exception:
        pass

    return {
        "chats_per_day": chats_per_day,
        "topic_distribution": topic_counts,
    }


# ---------------- Dashboard helpers ----------------
@router.get("/messages/recent")
async def recent_messages(limit: int = Query(20, ge=1, le=200), role: Optional[str] = Query(None)):
    """Return recent messages across all conversations for dashboard widgets.
    Optionally filter by role ('user' or 'assistant').
    """
    db = get_db()
    q = {}
    if role:
        q["role"] = role
    items: List[Dict[str, Any]] = []
    try:
        cursor = db.messages.find(q).sort("created_at", -1).limit(limit)
        async for m in cursor:
            items.append({
                "conversation_id": str(m.get("conversation_id")),
                "role": m.get("role"),
                "content": m.get("content"),
                "created_at": m.get("created_at"),
            })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load recent messages: {e}")
    return {"items": items}


@router.post("/memories/refresh_summary")
async def refresh_summary(conversation_id: str, user_key: Optional[str] = None):
    try:
        await update_conversation_summary(conversation_id, user_key)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh summary: {e}")


# ---------------- Top queries ----------------
@router.get("/queries/top")
async def top_queries(limit: int = Query(5, ge=1, le=50), window_days: int = Query(7, ge=1, le=365)):
    """Top repeated user queries in the window (by exact content match)."""
    db = get_db()
    since = datetime.utcnow() - timedelta(days=window_days)
    items: List[Dict[str, Any]] = []
    try:
        pipeline = [
            {"$match": {"role": "user", "created_at": {"$gte": since}}},
            {"$group": {"_id": "$content", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit},
        ]
        async for d in db.messages.aggregate(pipeline):
            items.append({"query": d.get("_id") or "", "count": d.get("count", 0)})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute top queries: {e}")
    return {"items": items}


# ---------------- Settings (config + secrets) ----------------
def _fernet() -> Fernet:
    # Derive a stable fernet key from JWT_SECRET
    raw = hashlib.sha256((settings.JWT_SECRET or "change-me").encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(raw)
    return Fernet(key)


def _enc(plain: str) -> str:
    return _fernet().encrypt((plain or "").encode("utf-8")).decode("ascii")


def _mask(s: Optional[str]) -> str:
    if not s:
        return ""
    if len(s) <= 6:
        return "*" * len(s)
    return ("*" * (len(s) - 4)) + s[-4:]


@router.get("/settings")
async def get_settings():
    db = get_db()
    doc = await db.admin_settings.find_one({"_id": "app"}) or {}
    cfg = doc.get("config", {})
    sec = doc.get("secrets", {})
    # Return only masked hints (****last4) without storing plaintext
    return {
        "config": {
            "model": cfg.get("model", settings.GEMINI_MODEL),
            "temperature": cfg.get("temperature", 0.7),
            "max_tokens": cfg.get("max_tokens", 2048),
            "tone": cfg.get("tone", "Professional + Friendly"),
            "greeting": cfg.get("greeting", "Hi, I'm Taliyo AI. How can I help you today?"),
            "system_prompt": cfg.get("system_prompt", ""),
            "context_limit": cfg.get("context_limit", settings.MEMORY_MAX_MESSAGES),
            "backup_enabled": cfg.get("backup_enabled", False),
            "backup_interval_hours": cfg.get("backup_interval_hours", 24),
            "rate_limit_per_minute": cfg.get("rate_limit_per_minute", 0),
            "encryption_at_rest": cfg.get("encryption_at_rest", False),
        },
        "secrets": {
            "gemini_api_key": ("****" + (sec.get("gemini_api_key_last4") or "")) if sec.get("gemini_api_key") else "",
            "pinecone_api_key": ("****" + (sec.get("pinecone_api_key_last4") or "")) if sec.get("pinecone_api_key") else "",
            "google_search_api_key": ("****" + (sec.get("google_search_api_key_last4") or "")) if sec.get("google_search_api_key") else "",
            "firebase_key": ("****" + (sec.get("firebase_key_last4") or "")) if sec.get("firebase_key") else "",
        },
    }


@router.put("/settings")
async def put_settings(body: Dict[str, Any]):
    db = get_db()
    doc = await db.admin_settings.find_one({"_id": "app"}) or {"_id": "app"}
    cfg = doc.get("config", {})
    sec = doc.get("secrets", {})

    new_cfg = body.get("config") or {}
    cfg.update({k: v for k, v in new_cfg.items() if v is not None})

    new_sec = body.get("secrets") or {}
    # Only update provided secrets and store encrypted along with last4 for masking
    for key in ["gemini_api_key", "pinecone_api_key", "google_search_api_key", "firebase_key"]:
        if key in new_sec and (new_sec[key] or "").strip():
            val = str(new_sec[key])
            sec[key] = _enc(val)
            sec[key + "_last4"] = val[-4:] if len(val) >= 4 else val

    await db.admin_settings.update_one({"_id": "app"}, {"$set": {"config": cfg, "secrets": sec}}, upsert=True)
    return {"ok": True}


@router.get("/settings/test")
async def test_connection(service: str = Query(...)):
    db = get_db()
    allowed = {"gemini", "mongodb", "vector"}
    if service not in allowed:
        return {"ok": False, "error": "Unknown service"}
    if service == "mongodb":
        try:
            await db.command("ping")
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    if service == "gemini":
        try:
            # Attempt a tiny embed call
            from app.services.rag_service import _embed_text  # reuse
            _ = await run_in_threadpool(_embed_text, "hello")
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    if service == "vector":
        try:
            from app.services.rag_service import query_similar
            _ = await query_similar("test", k=1)
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    return {"ok": False, "error": "Unknown service"}


# ---------------- Backups ----------------
async def _export_collection(coll_name: str, dir_path: str) -> int:
    db = get_db()
    coll = db[coll_name]
    count = 0
    path = os.path.join(dir_path, f"{coll_name}.jsonl")
    # Stream documents and write line-delimited JSON
    cursor = coll.find({})
    with open(path, "w", encoding="utf-8") as f:
        async for doc in cursor:
            try:
                # Convert ObjectId where needed
                if doc.get("_id") is not None:
                    doc["_id"] = str(doc["_id"])
                f.write(json.dumps(doc, default=str) + "\n")
                count += 1
            except Exception:
                pass
    return count


@router.post("/backup/create")
async def backup_create():
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    dir_path = os.path.join(settings.LOCAL_ARCHIVE_DIR, f"backup_{stamp}")
    os.makedirs(dir_path, exist_ok=True)
    collections = [
        "conversations",
        "messages",
        settings.RAG_COLLECTION,
        "mem_profiles",
        "mem_summaries",
        "telemetry",
        "admin_settings",
        "kb_facts",
    ]
    result: Dict[str, Any] = {"dir": dir_path, "collections": {}}
    for c in collections:
        try:
            n = await _export_collection(c, dir_path)
            result["collections"][c] = n
        except Exception as e:
            result["collections"][c] = f"error: {e}"
    return result


@router.get("/backup/list")
async def backup_list():
    base = settings.LOCAL_ARCHIVE_DIR
    try:
        dirs = [d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d)) and d.startswith("backup_")]
        dirs.sort(reverse=True)
        return {"backups": dirs}
    except Exception as e:
        return {"backups": [], "error": str(e)}


# ---------------- Training: Facts CRUD ----------------
@router.get("/facts")
async def list_facts(limit: int = Query(200, ge=1, le=1000)):
    db = get_db()
    items: List[Dict[str, Any]] = []
    try:
        cursor = db.kb_facts.find({}).sort("updated_at", -1).limit(limit)
        async for d in cursor:
            items.append({
                "id": str(d.get("_id")),
                "text": d.get("text", ""),
                "tags": d.get("tags", []),
                "updated_at": d.get("updated_at"),
            })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list facts: {e}")
    return {"items": items}


@router.post("/facts")
async def create_fact(body: Dict[str, Any]):
    db = get_db()
    doc = {
        "text": (body.get("text") or "").strip(),
        "tags": body.get("tags") or [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    r = await db.kb_facts.insert_one(doc)
    return {"id": str(r.inserted_id)}


@router.put("/facts/{fact_id}")
async def update_fact(fact_id: str, body: Dict[str, Any]):
    db = get_db()
    upd: Dict[str, Any] = {"updated_at": datetime.utcnow()}
    if "text" in body:
        upd["text"] = (body.get("text") or "").strip()
    if "tags" in body:
        upd["tags"] = body.get("tags") or []
    try:
        oid = ObjectId(fact_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid fact id")
    await db.kb_facts.update_one({"_id": oid}, {"$set": upd}, upsert=False)
    return {"ok": True}


@router.delete("/facts/{fact_id}")
async def delete_fact(fact_id: str):
    db = get_db()
    try:
        oid = ObjectId(fact_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid fact id")
    r = await db.kb_facts.delete_one({"_id": oid})
    return {"ok": True, "deleted": r.deleted_count}


# ---------------- Users, Roles, Audit Log CRUD ----------------
@router.get("/users")
async def list_users(limit: int = Query(200, ge=1, le=1000)):
    db = get_db()
    items: List[Dict[str, Any]] = []
    try:
        cursor = db.users.find({}).sort("updated_at", -1).limit(limit)
        async for d in cursor:
            items.append({
                "id": str(d.get("_id")),
                "username": d.get("username", ""),
                "role": d.get("role", ""),
                "updated_at": d.get("updated_at"),
            })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list users: {e}")
    return {"items": items}


@router.post("/users")
async def create_user(body: Dict[str, Any]):
    db = get_db()
    doc = {
        "username": (body.get("username") or "").strip(),
        "role": (body.get("role") or "").strip(),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    r = await db.users.insert_one(doc)
    return {"id": str(r.inserted_id)}


@router.put("/users/{user_id}")
async def update_user(user_id: str, body: Dict[str, Any]):
    db = get_db()
    upd: Dict[str, Any] = {"updated_at": datetime.utcnow()}
    if "username" in body:
        upd["username"] = (body.get("username") or "").strip()
    if "role" in body:
        upd["role"] = (body.get("role") or "").strip()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")
    await db.users.update_one({"_id": oid}, {"$set": upd}, upsert=False)
    return {"ok": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    db = get_db()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")
    r = await db.users.delete_one({"_id": oid})
    return {"ok": True, "deleted": r.deleted_count}


@router.get("/roles")
async def list_roles(limit: int = Query(200, ge=1, le=1000)):
    db = get_db()
    items: List[Dict[str, Any]] = []
    try:
        cursor = db.roles.find({}).sort("updated_at", -1).limit(limit)
        async for d in cursor:
            items.append({
                "id": str(d.get("_id")),
                "name": d.get("name", ""),
                "permissions": d.get("permissions", []),
                "updated_at": d.get("updated_at"),
            })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list roles: {e}")
    return {"items": items}


@router.post("/roles")
async def create_role(body: Dict[str, Any]):
    db = get_db()
    doc = {
        "name": (body.get("name") or "").strip(),
        "permissions": body.get("permissions") or [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    r = await db.roles.insert_one(doc)
    return {"id": str(r.inserted_id)}


@router.put("/roles/{role_id}")
async def update_role(role_id: str, body: Dict[str, Any]):
    db = get_db()
    upd: Dict[str, Any] = {"updated_at": datetime.utcnow()}
    if "name" in body:
        upd["name"] = (body.get("name") or "").strip()
    if "permissions" in body:
        upd["permissions"] = body.get("permissions") or []
    try:
        oid = ObjectId(role_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid role id")
    await db.roles.update_one({"_id": oid}, {"$set": upd}, upsert=False)
    return {"ok": True}


@router.delete("/roles/{role_id}")
async def delete_role(role_id: str):
    db = get_db()
    try:
        oid = ObjectId(role_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid role id")
    r = await db.roles.delete_one({"_id": oid})
    return {"ok": True, "deleted": r.deleted_count}


@router.get("/audit-log")
async def list_audit_log(limit: int = Query(200, ge=1, le=1000)):
    db = get_db()
    items: List[Dict[str, Any]] = []
    try:
        cursor = db.audit_log.find({}).sort("created_at", -1).limit(limit)
        async for d in cursor:
            items.append({
                "id": str(d.get("_id")),
                "action": d.get("action", ""),
                "user_id": str(d.get("user_id", "")),
                "created_at": d.get("created_at"),
            })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list audit log: {e}")
    return {"items": items}
