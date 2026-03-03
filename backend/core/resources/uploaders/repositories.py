from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from database.mongo_factory import get_mongo
from core.resources.uploaders.constants import UPLOADERS_COLLECTION, API_KEYS_COLLECTION


@dataclass
class UploadersRepository:
    async def insert(self, doc: Dict[str, Any]) -> None:
        mongo = get_mongo()
        await mongo.db[UPLOADERS_COLLECTION].insert_one(doc)

    async def find_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        mongo = get_mongo()
        return await mongo.db[UPLOADERS_COLLECTION].find_one({"email": email})

    async def find_by_id(self, uploader_id: str) -> Optional[Dict[str, Any]]:
        mongo = get_mongo()
        return await mongo.db[UPLOADERS_COLLECTION].find_one({"id": uploader_id})

    async def find_by_user_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        mongo = get_mongo()
        return await mongo.db[UPLOADERS_COLLECTION].find_one({"userId": user_id})

    async def list_all(self) -> List[Dict[str, Any]]:
        mongo = get_mongo()
        cursor = mongo.db[UPLOADERS_COLLECTION].find({}).sort("createdAt", -1)
        return [d async for d in cursor]

    async def count_all(self) -> int:
        mongo = get_mongo()
        return await mongo.db[UPLOADERS_COLLECTION].count_documents({})

    async def update_status(self, uploader_id: str, status: str) -> None:
        mongo = get_mongo()
        await mongo.db[UPLOADERS_COLLECTION].update_one({"id": uploader_id}, {"$set": {"status": status}})

    async def bind_user_id(self, uploader_id: str, user_id: str) -> None:
        mongo = get_mongo()
        await mongo.db[UPLOADERS_COLLECTION].update_one({"id": uploader_id}, {"$set": {"userId": user_id}})

    async def delete(self, uploader_id: str) -> None:
        mongo = get_mongo()
        await mongo.db[UPLOADERS_COLLECTION].delete_one({"id": uploader_id})


@dataclass
class ApiKeysRepository:
    async def insert(self, doc: Dict[str, Any]) -> None:
        mongo = get_mongo()
        await mongo.db[API_KEYS_COLLECTION].insert_one(doc)

    async def find_by_hash(self, key_hash: str) -> Optional[Dict[str, Any]]:
        mongo = get_mongo()
        return await mongo.db[API_KEYS_COLLECTION].find_one({"key_hash": key_hash, "status": "active"})

    async def list_by_uploader(self, uploader_id: str) -> List[Dict[str, Any]]:
        mongo = get_mongo()
        cursor = mongo.db[API_KEYS_COLLECTION].find({"uploader_id": uploader_id}).sort("createdAt", -1)
        return [d async for d in cursor]

    async def revoke_all_for_uploader(self, uploader_id: str) -> None:
        mongo = get_mongo()
        await mongo.db[API_KEYS_COLLECTION].update_many(
            {"uploader_id": uploader_id, "status": "active"},
            {"$set": {"status": "revoked", "revokedAt": datetime.utcnow()}}
        )

    async def revoke_key(self, key_id: str) -> None:
        mongo = get_mongo()
        await mongo.db[API_KEYS_COLLECTION].update_one(
            {"id": key_id},
            {"$set": {"status": "revoked", "revokedAt": datetime.utcnow()}}
        )
