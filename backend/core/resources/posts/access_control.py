from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from core.resources.uploaders.dtos import ApiKeyValidationRequest
from core.resources.uploaders.service import UploaderService


@dataclass
class AccessControlService:
    uploader_service: UploaderService = field(default_factory=UploaderService)

    async def setup(self) -> None:
        # Repositories handle their own setup if needed, 
        # but we could add an ensure_indexes to UploaderRepository
        pass

    async def validate_uploader(self, email: str, api_key: str) -> bool:
        if not api_key or not email:
            return False
        
        request = ApiKeyValidationRequest(email=email, apiKey=api_key)
        return await self.uploader_service.validate_api_key(request)

    async def is_uploader_user(self, email: Optional[str]) -> bool:
        if not email:
            return False
        uploader = await self.uploader_service.get_uploader_by_email(email)
        return uploader is not None


_access_service = AccessControlService()


def get_access_control_service() -> AccessControlService:
    return _access_service
