from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field

from core.logger.logger import get_logger
from core.services.cqrs.handler_registry import query_registry, mutation_registry, UnknownActionError
from core.plugins.auth.clerk_jwt import AuthError, verify_clerk_bearer_token
from core.plugins.auth.models import AuthUser


logger = get_logger(__name__)


RequestType = Literal["query", "mutation"]


class GenericRequest(BaseModel):
    type: RequestType
    action: str = Field(min_length=1)
    payload: Dict[str, Any] = Field(default_factory=dict)


router = APIRouter(tags=["cqrs"])


async def get_optional_user(authorization: Optional[str] = Header(default=None)) -> Optional[AuthUser]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        token = authorization.split(" ", 1)[1].strip()
        user_id = await verify_clerk_bearer_token(token)
        return AuthUser(user_id=user_id)
    except (AuthError, HTTPException, Exception):
        return None


@router.post("/api/execute")
async def execute(
    req: GenericRequest,
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    try:
        registry = query_registry if req.type == "query" else mutation_registry
        
        if req.type == "mutation" and not user:
            raise HTTPException(status_code=401, detail="authentication required for mutations")
        
        handler = registry.get(req.action)
        
        payload = req.payload.copy()
        if user:
            payload["userId"] = user.user_id
        
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
