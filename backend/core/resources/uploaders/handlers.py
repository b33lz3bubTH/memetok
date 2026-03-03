from __future__ import annotations

import hmac
from typing import Any, Dict
from fastapi import HTTPException
from pymongo.errors import PyMongoError

from core.logger.logger import get_logger
from core.resources.uploaders.actions import UploadersQueryAction, UploadersMutationAction
from core.resources.uploaders.service import UploaderService
from core.resources.uploaders.dtos import UploaderCreateRequest
from core.services.cqrs.handler_registry import query_registry, mutation_registry

logger = get_logger(__name__)


def register_uploaders_handlers(svc: UploaderService) -> None:
    def _check_super_admin(payload: Dict[str, Any]) -> None:
        from config.config import settings
        
        auth = payload.get("__auth", {})
        headers = auth.get("headers", {})
        
        # Use case-insensitive header check
        admin_key = None
        for k, v in headers.items():
            if k.lower() == "x-super-admin-key":
                admin_key = v
                break
        
        if not admin_key or not hmac.compare_digest(admin_key, settings.super_admin_api_key):
            logger.warning("unauthorized super admin attempt")
            raise HTTPException(status_code=401, detail="unauthorized super admin")

    async def handle_list_uploaders(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            _check_super_admin(payload)
            items = await svc.list_uploaders()
            return {
                "items": [
                    {
                        "id": i.id,
                        "email": i.email,
                        "name": i.name,
                        "status": i.status,
                        "createdAt": i.created_at.isoformat()
                    } for i in items
                ],
                "total": len(items)
            }
        except PyMongoError as e:
            logger.exception("list_uploaders db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    async def handle_validate_api_key(payload: Dict[str, Any]) -> Dict[str, Any]:
        email = str(payload.get("email", ""))
        api_key = str(payload.get("apiKey", ""))
        
        if not email or not api_key:
            raise HTTPException(status_code=400, detail="email and apiKey are required")
        
        is_valid = await svc.validate_api_key(api_key=api_key, email=email)
        return {"isValid": is_valid}

    async def handle_get_my_access(payload: Dict[str, Any]) -> Dict[str, Any]:
        auth = payload.get("__auth", {})
        user = auth.get("user")
        if not user:
            raise HTTPException(status_code=401, detail="authentication required")
        
        email = user.email or payload.get("email")
        if isinstance(email, str):
            email = email.lower()
            
        from core.resources.posts.access_control import get_access_control_service
        access_service = get_access_control_service()
        is_uploader = await access_service.is_uploader_user(email)
        
        return {
            "userId": user.user_id,
            "isUploader": is_uploader
        }

    async def handle_create_uploader(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            _check_super_admin(payload)
            email = str(payload.get("email", ""))
            name = payload.get("name")
            if not email:
                raise HTTPException(status_code=400, detail="email is required")
            
            request = UploaderCreateRequest(email=email, name=name)
            uploader, raw_key, already_exists = await svc.create_uploader(request)
            return {
                "id": uploader.id,
                "email": uploader.email,
                "name": uploader.name,
                "status": uploader.status,
                "apiKey": raw_key,
                "createdAt": uploader.created_at.isoformat(),
                "alreadyExists": already_exists
            }
        except PyMongoError as e:
            logger.exception("create_uploader db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    async def handle_update_uploader_status(payload: Dict[str, Any]) -> Dict[str, Any]:
        _check_super_admin(payload)
        uploader_id = str(payload.get("uploaderId", ""))
        status = str(payload.get("status", ""))
        if not uploader_id or not status:
            raise HTTPException(status_code=400, detail="uploaderId and status are required")
        
        await svc.update_status(uploader_id, status)
        return {"success": True}

    async def handle_revoke_api_key(payload: Dict[str, Any]) -> Dict[str, Any]:
        _check_super_admin(payload)
        uploader_id = str(payload.get("uploaderId", ""))
        if not uploader_id:
            raise HTTPException(status_code=400, detail="uploaderId is required")
        
        new_key = await svc.revoke_api_key(uploader_id)
        return {"apiKey": new_key}

    query_registry.register(UploadersQueryAction.LIST_UPLOADERS, handle_list_uploaders)
    query_registry.register(UploadersQueryAction.VALIDATE_API_KEY, handle_validate_api_key)
    query_registry.register(UploadersQueryAction.GET_MY_ACCESS, handle_get_my_access)

    mutation_registry.register(UploadersMutationAction.CREATE_UPLOADER, handle_create_uploader)
    mutation_registry.register(UploadersMutationAction.UPDATE_UPLOADER_STATUS, handle_update_uploader_status)
    mutation_registry.register(UploadersMutationAction.REVOKE_API_KEY, handle_revoke_api_key)
