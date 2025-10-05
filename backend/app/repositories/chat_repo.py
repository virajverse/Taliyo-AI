from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Tuple

from bson import ObjectId

from app.db.mongo import get_db

# If MongoDB is not reachable (e.g., TLS/network issues), we fall back to an
# in-memory store so the app keeps working like ChatGPT (no persistence).
_USE_MEM: bool = False
_mem_convs: dict[str, dict] = {}
_mem_msgs: dict[str, list[dict]] = {}


def _obj_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        raise ValueError("Invalid conversation id")


def _now() -> datetime:
    return datetime.utcnow()


def _title_from(text: str) -> str:
    t = (text or "").strip().replace("\n", " ")
    if len(t) > 60:
        t = t[:57] + "..."
    return t or "New conversation"


async def init_indexes() -> None:
    global _USE_MEM
    if _USE_MEM:
        return
    try:
        db = get_db()
        await db.conversations.create_index("updated_at")
        await db.conversations.create_index("user_key")
        await db.conversations.create_index("deleted_at")
        await db.messages.create_index("conversation_id")
        await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    except Exception:
        _USE_MEM = True


async def ensure_conversation(conversation_id: Optional[str], title_seed: str, user_key: Optional[str] = None) -> str:
    global _USE_MEM
    if not _USE_MEM:
        try:
            db = get_db()
            if conversation_id:
                oid = _obj_id(conversation_id)
                doc = await db.conversations.find_one({"_id": oid}, projection={"_id": 1})
                if doc:
                    return conversation_id
            # create new
            doc = {
                "title": _title_from(title_seed),
                **({"user_key": user_key} if user_key else {}),
                "created_at": _now(),
                "updated_at": _now(),
            }
            result = await db.conversations.insert_one(doc)
            return str(result.inserted_id)
        except Exception:
            _USE_MEM = True
    # memory fallback
    if conversation_id and conversation_id in _mem_convs:
        return conversation_id
    new_id = str(ObjectId())
    _mem_convs[new_id] = {
        "id": new_id,
        "title": _title_from(title_seed),
        **({"user_key": user_key} if user_key else {}),
        "created_at": _now(),
        "updated_at": _now(),
    }
    _mem_msgs[new_id] = []
    return new_id


async def add_message(conversation_id: str, role: str, content: str) -> None:
    global _USE_MEM
    if not _USE_MEM:
        try:
            db = get_db()
            oid = _obj_id(conversation_id)
            msg = {
                "conversation_id": oid,
                "role": role,
                "content": content,
                "created_at": _now(),
            }
            await db.messages.insert_one(msg)
            await db.conversations.update_one({"_id": oid}, {"$set": {"updated_at": _now()}})
            return
        except Exception:
            _USE_MEM = True
    # memory fallback
    conv = _mem_convs.get(conversation_id)
    if not conv:
        raise ValueError("Conversation not found")
    _mem_msgs.setdefault(conversation_id, []).append({
        "role": role,
        "content": content,
        "created_at": _now(),
    })
    conv["updated_at"] = _now()


async def list_conversations() -> List[dict]:
    global _USE_MEM
    if not _USE_MEM:
        try:
            db = get_db()
            cursor = db.conversations.find({"deleted_at": {"$exists": False}}, projection={"title": 1, "updated_at": 1}).sort("updated_at", -1)
            items = []
            async for d in cursor:
                items.append({"id": str(d["_id"]), "title": d.get("title", "Untitled"), "updated_at": d.get("updated_at")})
            return items
        except Exception:
            _USE_MEM = True
    # memory fallback
    items = []
    for cid, conv in _mem_convs.items():
        if conv.get("deleted_at"):
            continue
        items.append({"id": cid, "title": conv.get("title", "Untitled"), "updated_at": conv.get("updated_at")})
    # sort by updated_at desc
    items.sort(key=lambda x: x.get("updated_at") or _now(), reverse=True)
    return items


async def get_conversation(conversation_id: str) -> Tuple[dict, List[dict]]:
    global _USE_MEM
    if not _USE_MEM:
        try:
            db = get_db()
            oid = _obj_id(conversation_id)
            conv = await db.conversations.find_one({"_id": oid})
            if not conv or conv.get("deleted_at"):
                raise ValueError("Conversation not found")
            msgs_cursor = db.messages.find({"conversation_id": oid}).sort("created_at", 1)
            msgs = []
            async for m in msgs_cursor:
                msgs.append({
                    "role": m.get("role"),
                    "content": m.get("content"),
                    "created_at": m.get("created_at"),
                })
            conv_doc = {
                "id": str(conv["_id"]),
                "title": conv.get("title", "Untitled"),
                "created_at": conv.get("created_at"),
                "updated_at": conv.get("updated_at"),
            }
            return conv_doc, msgs
        except Exception:
            _USE_MEM = True
    # memory fallback
    conv = _mem_convs.get(conversation_id)
    if not conv or conv.get("deleted_at"):
        raise ValueError("Conversation not found")
    msgs = list(_mem_msgs.get(conversation_id, []))
    conv_doc = {
        "id": conv["id"],
        "title": conv.get("title", "Untitled"),
        "created_at": conv.get("created_at"),
        "updated_at": conv.get("updated_at"),
    }
    return conv_doc, msgs


async def delete_conversation(conversation_id: str) -> None:
    global _USE_MEM
    if not _USE_MEM:
        try:
            db = get_db()
            oid = _obj_id(conversation_id)
            # Soft delete: preserve all data; just mark conversation as deleted
            await db.conversations.update_one({"_id": oid}, {"$set": {"deleted_at": _now()}})
            return
        except Exception:
            _USE_MEM = True
    # memory fallback
    conv = _mem_convs.get(conversation_id)
    if conv:
        conv["deleted_at"] = _now()
