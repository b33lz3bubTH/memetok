from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from database.mongo_factory import get_mongo
from core.resources.uploaders.constants import UPLOADERS_COLLECTION, API_KEYS_COLLECTION
from core.resources.uploaders.types import ApiKeyDoc, UploaderDoc


@dataclass
class UploadersRepository:
    async def insert(self, doc: UploaderDoc) -> None:
        mongo = get_mongo()
        await mongo.db[UPLOADERS_COLLECTION].insert_one(doc)

    async def find_by_email(self, email: str) -> Optional[UploaderDoc]:
        mongo = get_mongo()
        return await mongo.db[UPLOADERS_COLLECTION].find_one({"email": email})

    async def find_by_id(self, uploader_id: str) -> Optional[UploaderDoc]:
        mongo = get_mongo()
        return await mongo.db[UPLOADERS_COLLECTION].find_one({"id": uploader_id})

    async def list_all(self) -> list[UploaderDoc]:
        mongo = get_mongo()
        cursor = mongo.db[UPLOADERS_COLLECTION].find({}).sort("createdAt", -1)
        return [d async for d in cursor]

    async def count_all(self) -> int:
        mongo = get_mongo()
        return await mongo.db[UPLOADERS_COLLECTION].count_documents({})

    async def update_status(self, uploader_id: str, status: str) -> None:
        mongo = get_mongo()
        await mongo.db[UPLOADERS_COLLECTION].update_one({"id": uploader_id}, {"$set": {"status": status}})

    async def delete(self, uploader_id: str) -> None:
        mongo = get_mongo()
        await mongo.db[UPLOADERS_COLLECTION].delete_one({"id": uploader_id})


@dataclass
class ApiKeysRepository:
    async def insert(self, doc: ApiKeyDoc) -> None:
        mongo = get_mongo()
        await mongo.db[API_KEYS_COLLECTION].insert_one(doc)

    async def find_by_hash(self, key_hash: str) -> Optional[ApiKeyDoc]:
        mongo = get_mongo()
        return await mongo.db[API_KEYS_COLLECTION].find_one({"key_hash": key_hash, "status": "active"})

    async def list_by_uploader(self, uploader_id: str) -> list[ApiKeyDoc]:
        mongo = get_mongo()
        cursor = mongo.db[API_KEYS_COLLECTION].find({"uploader_id": uploader_id}).sort("createdAt", -1)
        return [d async for d in cursor]

    async def revoke_all_for_uploader(self, uploader_id: str) -> None:
        mongo = get_mongo()
        await mongo.db[API_KEYS_COLLECTION].update_many(
            {"uploader_id": uploader_id, "status": "active"},
            {"$set": {"status": "revoked", "revokedAt": datetime.now(timezone.utc)}}
        )

    async def revoke_key(self, key_id: str) -> None:
        mongo = get_mongo()
        await mongo.db[API_KEYS_COLLECTION].update_one(
            {"id": key_id},
            {"$set": {"status": "revoked", "revokedAt": datetime.now(timezone.utc)}}
        )
