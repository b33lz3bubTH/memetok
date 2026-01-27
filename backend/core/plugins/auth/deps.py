from __future__ import annotations

from fastapi import Depends, Header, HTTPException

from core.plugins.auth.clerk_jwt import AuthError, verify_clerk_bearer_token
from core.plugins.auth.models import AuthUser


async def get_current_user(authorization: str | None = Header(default=None)) -> AuthUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    try:
        user_id = await verify_clerk_bearer_token(token)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    return AuthUser(user_id=user_id)


CurrentUser = Depends(get_current_user)

