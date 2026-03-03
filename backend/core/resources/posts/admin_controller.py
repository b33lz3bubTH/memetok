from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field

from config.config import settings
from core.plugins.auth.deps import CurrentUser
from core.plugins.auth.models import AuthUser
from core.resources.posts.access_control import get_access_control_service

router = APIRouter(tags=["super-admin"])


class AddUploaderRequest(BaseModel):
    email: EmailStr


class CreateApiKeyRequest(BaseModel):
    name: str = Field(default="default", min_length=1, max_length=100)


def _assert_super_admin(x_super_admin_key: str | None) -> None:
    if not x_super_admin_key or x_super_admin_key != settings.super_admin_api_key:
        raise HTTPException(status_code=401, detail="invalid super admin key")


@router.get("/super-admin/uploaders")
async def list_uploaders(x_super_admin_key: str | None = Header(default=None, alias="X-SUPER-ADMIN-KEY")):
    _assert_super_admin(x_super_admin_key)
    svc = get_access_control_service()
    items = await svc.repo.list_uploaders()
    return {"items": items}


@router.post("/super-admin/uploaders")
async def add_uploader(payload: AddUploaderRequest, x_super_admin_key: str | None = Header(default=None, alias="X-SUPER-ADMIN-KEY")):
    _assert_super_admin(x_super_admin_key)
    svc = get_access_control_service()
    item = await svc.repo.add_uploader_email(email=payload.email, created_by="super-admin")
    return item


@router.get("/super-admin/api-keys")
async def list_api_keys(x_super_admin_key: str | None = Header(default=None, alias="X-SUPER-ADMIN-KEY")):
    _assert_super_admin(x_super_admin_key)
    svc = get_access_control_service()
    items = await svc.repo.list_api_keys()
    return {"items": items}


@router.post("/super-admin/api-keys")
async def create_api_key(payload: CreateApiKeyRequest, x_super_admin_key: str | None = Header(default=None, alias="X-SUPER-ADMIN-KEY")):
    _assert_super_admin(x_super_admin_key)
    svc = get_access_control_service()
    return await svc.repo.generate_api_key(name=payload.name, created_by="super-admin")


@router.post("/super-admin/api-keys/{key_id}/revoke")
async def revoke_api_key(key_id: str, x_super_admin_key: str | None = Header(default=None, alias="X-SUPER-ADMIN-KEY")):
    _assert_super_admin(x_super_admin_key)
    svc = get_access_control_service()
    revoked = await svc.repo.revoke_api_key(key_id=key_id, revoked_by="super-admin")
    if not revoked:
        raise HTTPException(status_code=404, detail="api key not found or already revoked")
    return {"revoked": True, "keyId": key_id}


@router.get("/me/access")
async def get_my_access(user: AuthUser = CurrentUser):
    svc = get_access_control_service()
    is_uploader = await svc.is_uploader_user(user.user_id)
    return {"userId": user.user_id, "isUploader": is_uploader}
