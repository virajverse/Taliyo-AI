from __future__ import annotations

from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, Iterable
from io import BytesIO
import hashlib

import google.generativeai as genai
from bson import ObjectId
from pypdf import PdfReader

from app.core.config import settings
from app.db.mongo import get_db


def _embed_text(text: str) -> List[float]:
    """Return embedding vector for the given text using Google embeddings."""
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = settings.EMBEDDING_MODEL
    result = genai.embed_content(model=model, content=text)
    vec = result.get("embedding") or result.get("data", {}).get("embedding")
    if not isinstance(vec, list):
        raise RuntimeError("Failed to get embedding vector from Google API response")
    return vec


async def ensure_rag_indexes() -> None:
    """Create a vector search index on the RAG collection if missing.

    This uses Atlas Search's createSearchIndexes command. If it already exists or
    the cluster tier doesn't support it, failures are ignored.
    """
    db = get_db()
    coll_name = settings.RAG_COLLECTION
    try:
        # Determine embedding dimensionality dynamically
        dim = len(_embed_text("dimension probe"))
        definition = {
            "fields": [
                {
                    "type": "vector",
                    "path": "embedding",
                    "numDimensions": dim,
                    "similarity": "cosine",
                }
            ]
        }
        await db.command(
            {
                "createSearchIndexes": coll_name,
                "indexes": [
                    {"name": settings.RAG_VECTOR_INDEX, "definition": definition}
                ],
            }
        )
    except Exception:
        # Best-effort: ignore errors (index may already exist or tier not supported)
        pass


async def upsert_document(text: str, metadata: Optional[Dict[str, Any]] = None, id: Optional[str] = None) -> str:
    db = get_db()
    coll = db[settings.RAG_COLLECTION]
    emb = _embed_text(text)
    now = datetime.utcnow()
    doc: Dict[str, Any] = {
        "text": text,
        "embedding": emb,
        "metadata": metadata or {},
        "updated_at": now,
    }
    if id:
        try:
            _id = ObjectId(id)
        except Exception:
            _id = id  # allow custom string ids
        doc["_id"] = _id
        await coll.update_one({"_id": _id}, {"$set": doc}, upsert=True)
        return str(_id)
    else:
        doc["created_at"] = now
        result = await coll.insert_one(doc)
        return str(result.inserted_id)


async def query_similar(query: str, k: int = 5) -> List[Dict[str, Any]]:
    db = get_db()
    coll = db[settings.RAG_COLLECTION]
    emb = _embed_text(query)
    pipeline = [
        {
            "$vectorSearch": {
                "index": settings.RAG_VECTOR_INDEX,
                "path": "embedding",
                "queryVector": emb,
                "numCandidates": max(200, k * 40),
                "limit": k,
            }
        },
        {"$project": {"_id": 0, "text": 1, "metadata": 1, "score": {"$meta": "vectorSearchScore"}}},
    ]
    out: List[Dict[str, Any]] = []
    try:
        async for d in coll.aggregate(pipeline):
            out.append(d)
    except Exception as e:
        # If $vectorSearch is not available, return empty with an error message
        return [{"text": "", "metadata": {"error": str(e)}, "score": 0.0}]
    return out


# -------------------- Ingestion helpers --------------------
def _chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> Iterable[str]:
    text = (text or "").strip()
    if not text:
        return []
    chunks: List[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(n, start + chunk_size)
        chunk = text[start:end]
        chunks.append(chunk)
        if end >= n:
            break
        start = max(end - overlap, 0)
    return chunks


def _sha256_hex(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


async def ingest_pdf_bytes(pdf_bytes: bytes, filename: str = "document.pdf", user_key: Optional[str] = None,
                           chunk_size: int = 1000, overlap: int = 200) -> Tuple[int, str]:
    """Parse a PDF, chunk its text, and upsert into the RAG collection.

    Returns (num_chunks, doc_id). Chunks use deterministic IDs so re-upload updates instead of duplicating.
    """
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
    except Exception as e:
        raise RuntimeError(f"Failed to read PDF: {e}")

    doc_id = _sha256_hex(pdf_bytes)
    count = 0

    for p_idx, page in enumerate(reader.pages):
        try:
            p_text = page.extract_text() or ""
        except Exception:
            p_text = ""
        for c_idx, chunk in enumerate(_chunk_text(p_text, chunk_size=chunk_size, overlap=overlap)):
            meta = {
                "source": "pdf",
                "filename": filename,
                "page": p_idx + 1,
                "doc_id": doc_id,
                "user_key": user_key or None,
                "ingested_at": datetime.utcnow(),
            }
            # Deterministic string ID to avoid duplicates on re-ingestion
            chunk_id = f"{doc_id}:{p_idx+1}:{c_idx}"
            await upsert_document(text=chunk, metadata=meta, id=chunk_id)
            count += 1

    return count, doc_id
