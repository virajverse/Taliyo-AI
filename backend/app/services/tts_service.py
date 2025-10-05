from __future__ import annotations

from typing import Optional

import httpx
from fastapi import HTTPException

from app.core.config import settings


ELEVEN_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"


async def synthesize(text: str, voice_id: Optional[str] = None, model: Optional[str] = None, output: Optional[str] = None) -> bytes:
    """Synthesize speech using ElevenLabs API and return audio bytes.

    - voice_id: overrides default voice if provided
    - model: e.g., 'eleven_multilingual_v2', 'eleven_turbo_v2'
    - output: e.g., 'mp3_44100_128'
    """
    if not settings.ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not configured")

    voice = (voice_id or settings.ELEVENLABS_VOICE_ID or "").strip()
    if not voice:
        raise HTTPException(status_code=400, detail="voice_id is required (set default ELEVENLABS_VOICE_ID or pass in request)")

    model_id = (model or settings.ELEVENLABS_MODEL or "eleven_multilingual_v2").strip()
    output_fmt = (output or settings.ELEVENLABS_OUTPUT or "mp3_44100_128").strip()

    url = ELEVEN_TTS_URL.format(voice_id=voice)
    headers = {
        "xi-api-key": settings.ELEVENLABS_API_KEY,
        "accept": "audio/mpeg",
        "Content-Type": "application/json",
    }
    params = {"output_format": output_fmt}
    payload = {
        "text": text,
        "model_id": model_id,
        # Default voice settings can be tuned by the user later
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, headers=headers, params=params, json=payload)
        if resp.status_code != 200:
            try:
                err_json = resp.json()
            except Exception:
                err_json = {"detail": resp.text}
            raise HTTPException(status_code=resp.status_code, detail={"msg": "TTS failed", "error": err_json})
        return resp.content
