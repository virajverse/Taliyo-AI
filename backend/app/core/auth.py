from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import Header, HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = "HS256"


def _exp_time(minutes: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def create_access_token(claims: Dict[str, Any], expires_minutes: Optional[int] = None, return_exp: bool = False):
    to_encode = claims.copy()
    exp_minutes = int(expires_minutes or settings.JWT_EXPIRES_MIN)
    expire = _exp_time(exp_minutes)
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)
    if return_exp:
        return token, expire
    return token


def decode_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def require_auth(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    """
    Simple guard: if AUTH_PASSCODE is not set, allow all.
    If set, require a Bearer token in Authorization header.
    """
    if not settings.AUTH_PASSCODE:
        return {"anonymous": True}

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
    token = authorization.split(" ", 1)[1].strip()
    claims = decode_token(token)
    return claims


async def require_admin(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    """Strict guard for admin APIs: always require Bearer token even if passcode is disabled."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")
    token = authorization.split(" ", 1)[1].strip()
    claims = decode_token(token)
    return claims
