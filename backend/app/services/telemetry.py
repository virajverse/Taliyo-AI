from __future__ import annotations

import time
from typing import Any, Dict, Optional
from datetime import datetime

from app.db.mongo import get_db


async def log_event(event: str, data: Dict[str, Any]) -> None:
    """Store a telemetry event in MongoDB for basic analytics.

    Fields: event, ts, data
    """
    try:
        db = get_db()
        await db.telemetry.insert_one({
            "event": event,
            "ts": datetime.utcnow(),
            **({"data": data} if data else {}),
        })
    except Exception:
        # Never crash on telemetry
        pass
