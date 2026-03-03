from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from typing import Any, Dict, List
from uuid import uuid4

from database.mongo_common import now_utc
from database.mongo_factory import get_mongo

UPLOADER_ACCOUNTS_COLLECTION = "uploader_accounts"
UPLOADER_API_KEYS_COLLECTION = "uploader_api_keys"


def _hash_api_key(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


@dataclass
class AccessControlRepository:
    async def ensure_indexes(self) -> None:
        mongo = get_mongo()
        await mongo.db[UPLOADER_ACCOUNTS_COLLECTION].create_index("email", unique=True)
        await mongo.db[UPLOADER_ACCOUNTS_COLLECTION].create_index("userId", unique=True, sparse=True)
        await mongo.db[UPLOADER_API_KEYS_COLLECTION].create_index("keyHash", unique=True)

    async def add_uploader_email(self, email: str, created_by: str) -> Dict[str, Any]:
        mongo = get_mongo()
        now = now_utc()
        normalized = email.strip().lower()
        await mongo.db[UPLOADER_ACCOUNTS_COLLECTION].update_one(
            {"email": normalized},
            {
                "$set": {"email": normalized, "isActive": True, "updatedAt": now, "updatedBy": created_by},
                "$setOnInsert": {"id": str(uuid4()), "createdAt": now, "createdBy": created_by},
            },
            upsert=True,
        )
        doc = await mongo.db[UPLOADER_ACCOUNTS_COLLECTION].find_one({"email": normalized}, {"_id": 0})
        return doc or {}

    async def list_uploaders(self) -> List[Dict[str, Any]]:
        mongo = get_mongo()
        cursor = mongo.db[UPLOADER_ACCOUNTS_COLLECTION].find({}, {"_id": 0}).sort("createdAt", -1)
        return [d async for d in cursor]

    async def bind_uploader_user(self, email: str, user_id: str) -> None:
        mongo = get_mongo()
        now = now_utc()
        await mongo.db[UPLOADER_ACCOUNTS_COLLECTION].update_one(
            {"email": email.strip().lower(), "isActive": True},
            {"$set": {"userId": user_id, "updatedAt": now}},
        )

    async def is_uploader_email(self, email: str) -> bool:
        mongo = get_mongo()
        found = await mongo.db[UPLOADER_ACCOUNTS_COLLECTION].find_one(
            {"email": email.strip().lower(), "isActive": True}, {"_id": 1}
        )
        return found is not None

    async def is_uploader_user(self, user_id: str) -> bool:
        mongo = get_mongo()
        found = await mongo.db[UPLOADER_ACCOUNTS_COLLECTION].find_one({"userId": user_id, "isActive": True}, {"_id": 1})
        return found is not None

    async def generate_api_key(self, name: str, created_by: str) -> Dict[str, Any]:
        mongo = get_mongo()
        now = now_utc()
        raw_key = secrets.token_urlsafe(36)
        doc = {
            "id": str(uuid4()),
            "name": name.strip() or "default",
            "keyHash": _hash_api_key(raw_key),
            "createdAt": now,
            "createdBy": created_by,
            "revokedAt": None,
            "revokedBy": None,
        }
        await mongo.db[UPLOADER_API_KEYS_COLLECTION].insert_one(doc)
        return {"id": doc["id"], "name": doc["name"], "apiKey": raw_key, "createdAt": now.isoformat()}

    async def list_api_keys(self) -> List[Dict[str, Any]]:
        mongo = get_mongo()
        cursor = (
            mongo.db[UPLOADER_API_KEYS_COLLECTION]
            .find({"_id": 0, "keyHash": 0})
            .sort("createdAt", -1)
        )
        return [d async for d in cursor]

    async def revoke_api_key(self, key_id: str, revoked_by: str) -> bool:
        mongo = get_mongo()
        now = now_utc()
        result = await mongo.db[UPLOADER_API_KEYS_COLLECTION].update_one(
            {"id": key_id, "revokedAt": None}, {"$set": {"revokedAt": now, "revokedBy": revoked_by}}
        )
        return result.modified_count > 0

    async def is_active_api_key(self, provided_key: str) -> bool:
        mongo = get_mongo()
        found = await mongo.db[UPLOADER_API_KEYS_COLLECTION].find_one(
            {"keyHash": _hash_api_key(provided_key), "revokedAt": None}, {"_id": 1}
        )
        return found is not None


@dataclass
class AccessControlService:
    repo: AccessControlRepository

    async def setup(self) -> None:
        await self.repo.ensure_indexes()

    async def validate_uploader(self, user_id: str, email: str, api_key: str) -> bool:
        if not email:
            return False
        is_allowed_email = await self.repo.is_uploader_email(email)
        if not is_allowed_email:
            return False
        is_valid_key = await self.repo.is_active_api_key(api_key)
        if not is_valid_key:
            return False
        await self.repo.bind_uploader_user(email=email, user_id=user_id)
        return True

    async def is_uploader_user(self, user_id: str) -> bool:
        return await self.repo.is_uploader_user(user_id)


_access_service = AccessControlService(repo=AccessControlRepository())


def get_access_control_service() -> AccessControlService:
    return _access_service
