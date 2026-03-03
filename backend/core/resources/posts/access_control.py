from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from core.resources.uploaders.service import UploaderService


@dataclass
class AccessControlService:
    uploader_service: UploaderService = field(default_factory=UploaderService)

    async def setup(self) -> None:
        # Repositories handle their own setup if needed, 
        # but we could add an ensure_indexes to UploaderRepository
        pass

    async def validate_uploader(self, user_id: str, email: str, api_key: str) -> bool:
        if not email or not api_key:
            return False
        return await self.uploader_service.validate_api_key(email=email, api_key=api_key, user_id=user_id)

    async def is_uploader_user(self, user_id: str) -> bool:
        # We need a method in UploaderService for this
        uploader_data = await self.uploader_service.repository.find_by_user_id(user_id)
        return uploader_data is not None


_access_service = AccessControlService()


def get_access_control_service() -> AccessControlService:
    return _access_service
