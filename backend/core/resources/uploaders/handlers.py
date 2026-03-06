from __future__ import annotations

import hmac
from typing import Any, Dict

from fastapi import HTTPException
from pydantic import ValidationError
from pymongo.errors import PyMongoError

from core.logger.logger import get_logger
from core.resources.uploaders.actions import UploadersMutationAction, UploadersQueryAction
from core.resources.uploaders.dtos import (
    ApiKeyValidationRequest,
    UploadersPayloadDTO,
    UploaderCreateRequest,
    UploaderIdRequest,
    UploaderStatusUpdateRequest,
)
from core.resources.uploaders.service import UploaderService
from core.services.cqrs.handler_registry import mutation_registry, query_registry

logger = get_logger(__name__)


def _parse_payload(payload_model, payload: Dict[str, Any]):
    try:
        return payload_model.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


def register_uploaders_handlers(svc: UploaderService) -> None:
    def _check_super_admin(req: UploadersPayloadDTO) -> None:
        from config.config import settings

        headers = req.auth.headers

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
            req = _parse_payload(UploadersPayloadDTO, payload)
            _check_super_admin(req)
            items = await svc.list_uploaders()
            return {
                "items": [
                    {
                        "id": i.id,
                        "email": i.email,
                        "name": i.name,
                        "status": i.status,
                        "createdAt": i.created_at.isoformat(),
                    }
                    for i in items
                ],
                "total": len(items),
            }
        except PyMongoError as e:
            logger.exception("list_uploaders db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    async def handle_validate_api_key(payload: Dict[str, Any]) -> Dict[str, Any]:
        req = _parse_payload(ApiKeyValidationRequest, payload)
        is_valid = await svc.validate_api_key(req)
        return {"isValid": is_valid}

    async def handle_get_my_access(payload: Dict[str, Any]) -> Dict[str, Any]:
        req = _parse_payload(UploadersPayloadDTO, payload)
        user = req.auth.user
        if not user:
            raise HTTPException(status_code=401, detail="authentication required")

        email = user.email or req.email
        if isinstance(email, str):
            email = email.lower()

        from core.resources.posts.access_control import get_access_control_service

        access_service = get_access_control_service()
        is_uploader = await access_service.is_uploader_user(email)

        return {"userId": user.user_id, "isUploader": is_uploader}

    async def handle_create_uploader(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            req = _parse_payload(UploaderCreateRequest, payload)
            auth_req = _parse_payload(UploadersPayloadDTO, payload)
            _check_super_admin(auth_req)
            uploader, raw_key, already_exists = await svc.create_uploader(req)
            return {
                "id": uploader.id,
                "email": uploader.email,
                "name": uploader.name,
                "status": uploader.status,
                "apiKey": raw_key,
                "createdAt": uploader.created_at.isoformat(),
                "alreadyExists": already_exists,
            }
        except PyMongoError as e:
            logger.exception("create_uploader db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    async def handle_update_uploader_status(payload: Dict[str, Any]) -> Dict[str, Any]:
        auth_req = _parse_payload(UploadersPayloadDTO, payload)
        _check_super_admin(auth_req)
        req = _parse_payload(UploaderStatusUpdateRequest, payload)
        await svc.update_status(req)
        return {"success": True}

    async def handle_revoke_api_key(payload: Dict[str, Any]) -> Dict[str, Any]:
        auth_req = _parse_payload(UploadersPayloadDTO, payload)
        _check_super_admin(auth_req)
        req = _parse_payload(UploaderIdRequest, payload)
        new_key = await svc.revoke_api_key(req)
        return {"apiKey": new_key}

    query_registry.register(UploadersQueryAction.LIST_UPLOADERS, handle_list_uploaders)
    query_registry.register(UploadersQueryAction.VALIDATE_API_KEY, handle_validate_api_key)
    query_registry.register(UploadersQueryAction.GET_MY_ACCESS, handle_get_my_access)

    mutation_registry.register(UploadersMutationAction.CREATE_UPLOADER, handle_create_uploader)
    mutation_registry.register(UploadersMutationAction.UPDATE_UPLOADER_STATUS, handle_update_uploader_status)
    mutation_registry.register(UploadersMutationAction.REVOKE_API_KEY, handle_revoke_api_key)
