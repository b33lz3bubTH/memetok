from __future__ import annotations

from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel, Field

from core.logger.logger import get_logger
from core.services.cqrs.handler_registry import Payload, query_registry, mutation_registry, UnknownActionError
from core.plugins.auth.clerk_jwt import AuthError, verify_clerk_bearer_token
from core.plugins.auth.models import AuthUser


logger = get_logger(__name__)


RequestType = Literal["query", "mutation"]


class GenericRequest(BaseModel):
    type: RequestType
    action: str = Field(min_length=1)
    payload: Payload = Field(default_factory=dict)


router = APIRouter(tags=["cqrs"])


async def get_optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[AuthUser]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        token = authorization.split(" ", 1)[1].strip()
        claims = await verify_clerk_bearer_token(token)
        return AuthUser(user_id=claims.user_id, email=claims.email)
    except (AuthError, HTTPException, Exception):
        return None


@router.post("/api/execute")
async def execute(
    req: GenericRequest,
    request: Request,
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    try:
        registry = query_registry if req.type == "query" else mutation_registry
        
        from config.config import settings
        is_super_admin = request.headers.get("x-super-admin-key") == settings.super_admin_api_key

        if req.type == "mutation" and not user and not is_super_admin:
            raise HTTPException(status_code=401, detail="authentication required for mutations")
        
        handler = registry.get(req.action)
        
        payload = req.payload.copy()
        payload["__auth"] = {
            "authenticated": bool(user),
            "user": user,
            "headers": dict(request.headers),
            "is_super_admin": is_super_admin
        }
        if user:
            payload["userId"] = user.user_id
            payload["requesterEmail"] = user.email
        
        result = await handler(payload)
        return result
    except UnknownActionError as e:
        logger.info("unknown action action=%s type=%s", req.action, req.type)
        raise HTTPException(status_code=404, detail=str(e)) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("execute error action=%s type=%s", req.action, req.type)
        raise HTTPException(status_code=500, detail="internal server error") from e
