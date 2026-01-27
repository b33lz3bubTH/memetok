from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from database.mongo_factory import get_mongo

UPLOAD_ERRORS_COLLECTION = "upload_errors"


@dataclass
class UploadErrorsRepository:
    async def insert(self, doc: Dict[str, Any]) -> Any:
        mongo = get_mongo()
        result = await mongo.db[UPLOAD_ERRORS_COLLECTION].insert_one(doc)
        return result.inserted_id

    async def find_by_post_id(self, post_id: str) -> Optional[Dict[str, Any]]:
        mongo = get_mongo()
        return await mongo.db[UPLOAD_ERRORS_COLLECTION].find_one({"postId": post_id})

    async def find_by_user_id(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        mongo = get_mongo()
        cursor = (
            mongo.db[UPLOAD_ERRORS_COLLECTION]
            .find({"userId": user_id})
            .sort("createdAt", -1)
            .limit(limit)
        )
        return [d async for d in cursor]
