from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any

import google.generativeai as genai

from app.core.config import settings
from app.db.mongo import get_db
from app.repositories.chat_repo import get_conversation


async def ensure_memory_indexes() -> None:
    db = get_db()
    await db.mem_profiles.create_index("user_key", unique=True)
    await db.mem_summaries.create_index([("user_key", 1), ("updated_at", -1)])
    await db.mem_summaries.create_index("conversation_id", unique=True)


async def get_user_memory(user_key: Optional[str]) -> Dict[str, Any]:
    if not user_key:
        return {"profile": "", "summaries": []}
    db = get_db()
    profile_doc = await db.mem_profiles.find_one({"user_key": user_key})
    summaries: List[str] = []
    cursor = db.mem_summaries.find({"user_key": user_key}).sort("updated_at", -1).limit(settings.GLOBAL_SUMMARIES_LIMIT)
    async for d in cursor:
        txt = (d.get("summary") or "").strip()
        if txt:
            summaries.append(txt)
    return {
        "profile": (profile_doc or {}).get("notes", ""),
        "summaries": summaries,
    }


def _summarize_with_gemini(text: str, max_words: int = 120) -> str:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    prompt = (
        "Summarize the following conversation snippet into "+str(max_words)+" words max, "
        "focusing on user goals, constraints, decisions, and key facts.\n\n" + text
    )
    model = genai.GenerativeModel(model_name=settings.GEMINI_MODEL)
    resp = model.generate_content(prompt)
    return (getattr(resp, "text", "") or "").strip()


async def update_conversation_summary(conversation_id: str, user_key: Optional[str]) -> None:
    # Fetch conversation messages
    conv, msgs = await get_conversation(conversation_id)
    # Build a compact transcript of last N messages
    last_msgs = msgs[- settings.MEMORY_MAX_MESSAGES :]
    transcript = "\n".join([f"{m['role']}: {m['content']}" for m in last_msgs])
    try:
        summary = _summarize_with_gemini(transcript)
    except Exception:
        summary = transcript[:800]  # fallback: crude truncation

    db = get_db()
    doc = {
        "conversation_id": conv["id"],
        "user_key": user_key,
        "summary": summary,
        "updated_at": datetime.utcnow(),
    }
    await db.mem_summaries.update_one({"conversation_id": conv["id"]}, {"$set": doc}, upsert=True)


async def get_memory_text(user_key: Optional[str]) -> str:
    mem = await get_user_memory(user_key)
    sections = []
    if mem.get("profile"):
        sections.append("Profile:\n" + mem["profile"])
    if mem.get("summaries"):
        joined = "\n- "+"\n- ".join(mem["summaries"]) if mem["summaries"] else ""
        sections.append("Prior conversation summaries:\n" + joined)
    return ("\n\n".join(sections)).strip()
