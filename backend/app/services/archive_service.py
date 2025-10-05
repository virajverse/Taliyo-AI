from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List

from bson.json_util import dumps

from app.core.config import settings
from app.db.mongo import get_db


def _now_iso() -> str:
    return datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")


async def _archive_cursor(cursor, writer, delete_ids, batch_size: int, dry_run: bool) -> Dict[str, Any]:
    total = 0
    uploaded = 0
    deleted = 0
    part = 0
    lines: List[str] = []
    ids: List[Any] = []

    async for doc in cursor:
        total += 1
        lines.append(dumps(doc))
        ids.append(doc["_id"])
        if len(lines) >= batch_size:
            part += 1
            if not dry_run:
                await writer(part, "\n".join(lines).encode("utf-8"))
                uploaded += len(lines)
                if delete_ids:
                    await delete_ids(ids)
                    deleted += len(ids)
            lines, ids = [], []

    # tail
    if lines:
        part += 1
        if not dry_run:
            await writer(part, "\n".join(lines).encode("utf-8"))
            uploaded += len(lines)
            if delete_ids:
                await delete_ids(ids)
                deleted += len(ids)

    return {"total": total, "uploaded": uploaded, "deleted": deleted, "parts": part}


async def archive_messages_local(days: int, batch_size: int = 5000, dry_run: bool = False) -> Dict[str, Any]:
    """Archive to local filesystem as JSONL files in settings.LOCAL_ARCHIVE_DIR."""
    db = get_db()
    cutoff = datetime.utcnow() - timedelta(days=days)
    cursor = db.messages.find({"created_at": {"$lt": cutoff}}).sort("_id", 1)

    outdir = Path(settings.LOCAL_ARCHIVE_DIR)
    outdir.mkdir(parents=True, exist_ok=True)

    async def writer(part: int, data: bytes):
        fname = outdir / f"archive-{_now_iso()}-part{part}.jsonl"
        await asyncio.to_thread(fname.write_bytes, data)
        return str(fname)

    async def delete_ids(ids: List[Any]):
        await db.messages.delete_many({"_id": {"$in": ids}})

    stats = await _archive_cursor(cursor, writer, delete_ids, batch_size, dry_run)
    return {
        "backend": "local",
        "dir": str(outdir),
        "cutoff": cutoff.isoformat() + "Z",
        "total_candidates": stats["total"],
        "uploaded": 0 if dry_run else stats["uploaded"],
        "deleted": 0 if dry_run else stats["deleted"],
        "parts": stats["parts"],
        "dry_run": dry_run,
    }

async def archive_messages(days: int, backend: str | None = None, dry_run: bool = False) -> Dict[str, Any]:
    """Archive messages older than N days to local disk as JSONL. Free, no cloud.

    The backend parameter is ignored and kept for backward compatibility.
    """
    return await archive_messages_local(days=days, dry_run=dry_run)
