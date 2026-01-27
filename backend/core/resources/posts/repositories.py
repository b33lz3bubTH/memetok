from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from pymongo import ReturnDocument

from database.mongo_factory import get_mongo
from core.resources.posts.constants import COMMENTS_COLLECTION, LIKES_COLLECTION, POSTS_COLLECTION
from common.app_constants import POST_STATUS_POSTED


@dataclass
class PostsRepository:
    async def insert(self, doc: Dict[str, Any]) -> None:
        mongo = get_mongo()
        await mongo.db[POSTS_COLLECTION].insert_one(doc)

    async def count_posts(self) -> int:
        mongo = get_mongo()
        count = await mongo.db[POSTS_COLLECTION].count_documents({})
        return count

    async def count_posts_by_user(self, user_id: str) -> int:
        mongo = get_mongo()
        count = await mongo.db[POSTS_COLLECTION].count_documents({"author.userId": user_id})
        return count

    async def find_latest_posted(self, take: int, skip: int) -> List[Dict[str, Any]]:
        mongo = get_mongo()
        cursor = (
            mongo.db[POSTS_COLLECTION]
            .find({"status": POST_STATUS_POSTED}, {"stats": 0})
            .sort("createdAt", -1)
            .skip(skip)
            .limit(take)
        )
        return [d async for d in cursor]

    async def find_by_user_id(self, user_id: str, take: int, skip: int) -> List[Dict[str, Any]]:
        mongo = get_mongo()
        cursor = (
            mongo.db[POSTS_COLLECTION]
            .find({"author.userId": user_id, "status": POST_STATUS_POSTED}, {"stats": 0})
            .sort("createdAt", -1)
            .skip(skip)
            .limit(take)
        )
        return [d async for d in cursor]

    async def find_by_id(self, post_id: str) -> Optional[Dict[str, Any]]:
        mongo = get_mongo()
        return await mongo.db[POSTS_COLLECTION].find_one({"id": post_id})

    async def set_status(self, post_id: str, status: str) -> None:
        mongo = get_mongo()
        await mongo.db[POSTS_COLLECTION].update_one({"id": post_id}, {"$set": {"status": status}})

    async def inc_counts(self, post_id: str, likes_delta: int = 0, comments_delta: int = 0) -> Dict[str, Any] | None:
        mongo = get_mongo()
        update: Dict[str, Any] = {"$inc": {}}
        if likes_delta:
            update["$inc"]["stats.likes"] = likes_delta
        if comments_delta:
            update["$inc"]["stats.comments"] = comments_delta
        if not update["$inc"]:
            return await mongo.db[POSTS_COLLECTION].find_one({"id": post_id})
        return await mongo.db[POSTS_COLLECTION].find_one_and_update(
            {"id": post_id},
            update,
            return_document=ReturnDocument.AFTER,
        )


@dataclass
class LikesRepository:
    async def toggle(self, post_id: str, user_id: str, now: datetime) -> bool:
        mongo = get_mongo()
        existing = await mongo.db[LIKES_COLLECTION].find_one({"postId": post_id, "userId": user_id})
        if existing:
            await mongo.db[LIKES_COLLECTION].delete_one({"_id": existing["_id"]})
            return False
        await mongo.db[LIKES_COLLECTION].insert_one({"postId": post_id, "userId": user_id, "createdAt": now})
        return True


@dataclass
class CommentsRepository:
    async def insert(self, doc: Dict[str, Any]) -> None:
        mongo = get_mongo()
        await mongo.db[COMMENTS_COLLECTION].insert_one(doc)

    async def find_latest(self, post_id: str, take: int, skip: int) -> List[Dict[str, Any]]:
        mongo = get_mongo()
        cursor = (
            mongo.db[COMMENTS_COLLECTION]
            .find({"postId": post_id})
            .sort("createdAt", -1)
            .skip(skip)
            .limit(take)
        )
        return [d async for d in cursor]

