from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.auth import create_access_token, require_auth

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    passcode: str


@router.post("/login")
def login(body: LoginRequest):
    # If passcode is configured, enforce it
    if settings.AUTH_PASSCODE:
        if body.passcode != settings.AUTH_PASSCODE:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid passcode")
    # Create a token regardless (keeps frontend consistent); if passcode disabled, token is still valid but not required
    token, exp = create_access_token({"sub": "user", "type": "access"}, return_exp=True)
    return {"token": token, "expires_at": exp.isoformat()}


@router.get("/verify")
def verify(_claims=Depends(require_auth)):
    # If require_auth passes (or is disabled), we are ok
    return {"ok": True}
