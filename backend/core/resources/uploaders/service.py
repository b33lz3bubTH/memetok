from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass, field
from typing import List, Optional, Protocol

from core.resources.uploaders.dtos import (
    ApiKeyValidationRequest,
    UploaderCreateRequest,
    UploaderIdRequest,
    UploaderStatusUpdateRequest,
)
from core.resources.uploaders.models import Uploader
from core.resources.uploaders.repositories import UploadersRepository
from core.resources.uploaders.types import ApiKeyDoc, UploaderDoc
from database.mongo_common import now_utc

from .models import ApiKey
from .repositories import ApiKeysRepository


class UploadersRepositoryProtocol(Protocol):
    async def find_by_email(self, email: str) -> UploaderDoc | None: ...
    async def insert(self, doc: UploaderDoc) -> None: ...
    async def list_all(self) -> list[UploaderDoc]: ...
    async def update_status(self, uploader_id: str, status: str) -> None: ...


class ApiKeysRepositoryProtocol(Protocol):
    async def insert(self, doc: ApiKeyDoc) -> None: ...
    async def find_by_hash(self, key_hash: str) -> ApiKeyDoc | None: ...
    async def revoke_all_for_uploader(self, uploader_id: str) -> None: ...


@dataclass
class UploaderService:
    repository: UploadersRepositoryProtocol = field(default_factory=UploadersRepository)
    api_key_repo: ApiKeysRepositoryProtocol = field(default_factory=ApiKeysRepository)

    async def create_uploader(self, request: UploaderCreateRequest) -> tuple[Uploader, Optional[str], bool]:
        existing = await self.repository.find_by_email(request.email)
        if existing:
            return Uploader.from_dict(existing), None, True

        uploader_id = str(uuid.uuid4())
        uploader = Uploader(
            id=uploader_id,
            email=request.email,
            name=request.name,
            status="active",
            created_at=now_utc(),
        )

        await self.repository.insert(uploader.to_dict())

        raw_key = await self.generate_api_key(uploader_id)

        return uploader, raw_key, False

    async def generate_api_key(self, uploader_id: str, name: Optional[str] = None) -> str:
        raw_key = self._generate_raw_key()
        api_key = ApiKey(
            id=str(uuid.uuid4()),
            uploader_id=uploader_id,
            key_hash=self._hash_api_key(raw_key),
            name=name,
            status="active",
            created_at=now_utc(),
        )
        await self.api_key_repo.insert(api_key.to_dict())
        return raw_key

    async def get_uploader_by_email(self, email: str) -> Optional[Uploader]:
        data = await self.repository.find_by_email(email)
        return Uploader.from_dict(data) if data else None

    async def list_uploaders(self) -> List[Uploader]:
        items = await self.repository.list_all()
        return [Uploader.from_dict(item) for item in items]

    async def validate_api_key(self, request: ApiKeyValidationRequest) -> bool:
        uploader_data = await self.repository.find_by_email(request.email)
        if not uploader_data:
            return False

        uploader = Uploader.from_dict(uploader_data)
        if uploader.status != "active":
            return False

        key_hash = self._hash_api_key(request.apiKey)
        key_data = await self.api_key_repo.find_by_hash(key_hash)
        if not key_data:
            return False

        key = ApiKey.from_dict(key_data)
        return key.uploader_id == uploader.id

    async def update_status(self, request: UploaderStatusUpdateRequest) -> None:
        await self.repository.update_status(request.uploaderId, request.status)

    async def revoke_api_key(self, request: UploaderIdRequest) -> str:
        await self.api_key_repo.revoke_all_for_uploader(request.uploaderId)
        return await self.generate_api_key(request.uploaderId)

    def _generate_raw_key(self) -> str:
        return f"mt_{secrets.token_urlsafe(32)}"

    def _hash_api_key(self, value: str) -> str:
        import hashlib

        return hashlib.sha256(value.encode("utf-8")).hexdigest()
