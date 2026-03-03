from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass, field
from typing import List, Optional

from core.resources.uploaders.models import Uploader
from database.mongo_common import now_utc
from core.resources.uploaders.repositories import UploadersRepository
from core.resources.uploaders.dtos import UploaderCreateRequest


from .models import ApiKey
from .repositories import ApiKeysRepository


@dataclass
class UploaderService:
    repository: UploadersRepository = field(default_factory=UploadersRepository)
    api_key_repo: ApiKeysRepository = field(default_factory=ApiKeysRepository)

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
            created_at=now_utc()
        )
        
        await self.repository.insert(uploader.to_dict())
        
        # Generate initial API key
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
            created_at=now_utc()
        )
        await self.api_key_repo.insert(api_key.to_dict())
        return raw_key

    async def get_uploader_by_email(self, email: str) -> Optional[Uploader]:
        data = await self.repository.find_by_email(email)
        return Uploader.from_dict(data) if data else None

    async def list_uploaders(self) -> List[Uploader]:
        items = await self.repository.list_all()
        return [Uploader.from_dict(item) for item in items]

    async def validate_api_key(self, api_key: str, email: str) -> bool:
        if not email:
            return False
            
        uploader_data = await self.repository.find_by_email(email)
        if not uploader_data:
            return False
            
        uploader = Uploader.from_dict(uploader_data)
        if uploader.status != "active":
            return False
            
        key_hash = self._hash_api_key(api_key)
        key_data = await self.api_key_repo.find_by_hash(key_hash)
        if not key_data:
            return False
        
        key = ApiKey.from_dict(key_data)
        if key.uploader_id != uploader.id:
            return False
            
        return True

    async def update_status(self, uploader_id: str, status: str) -> None:
        await self.repository.update_status(uploader_id, status)

    async def revoke_api_key(self, uploader_id: str) -> str:
        # Revoke all existing and generate a new one (legacy behavior)
        await self.api_key_repo.revoke_all_for_uploader(uploader_id)
        return await self.generate_api_key(uploader_id)

    def _generate_raw_key(self) -> str:
        return f"mt_{secrets.token_urlsafe(32)}"

    def _hash_api_key(self, value: str) -> str:
        import hashlib
        return hashlib.sha256(value.encode("utf-8")).hexdigest()
