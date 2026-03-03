from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from pymongo import ReturnDocument, ASCENDING, DESCENDING, TEXT

from database.mongo_factory import get_mongo
from core.resources.posts.constants import COMMENTS_COLLECTION, LIKES_COLLECTION, POSTS_COLLECTION, SAVED_POSTS_COLLECTION
from common.app_constants import POST_STATUS_POSTED


@dataclass
class PostsRepository:
    async def ensure_indexes(self) -> None:
        """Create indexes for all hot query paths. Safe to call multiple times."""
        mongo = get_mongo()
        col = mongo.db[POSTS_COLLECTION]
        await col.create_index([("status", ASCENDING), ("createdAt", DESCENDING)], background=True)
        await col.create_index([("author.userId", ASCENDING), ("createdAt", DESCENDING)], background=True)
        await col.create_index([("id", ASCENDING)], unique=True, background=True)
        # Full-text search index
        try:
            await col.create_index(
                [("caption", TEXT), ("description", TEXT), ("tags", TEXT)],
                background=True,
                name="posts_text_search",
            )
        except Exception:
            pass  # index likely already exists with a different spec

    async def insert(self, doc: Dict[str, Any]) -> None:
        mongo = get_mongo()
        await mongo.db[POSTS_COLLECTION].insert_one(doc)

    async def count_posts(self) -> int:
        mongo = get_mongo()
        count = await mongo.db[POSTS_COLLECTION].count_documents({})
        return count

    async def count_posts_by_user(self, user_id: str) -> int:
        mongo = get_mongo()
        count = await mongo.db[POSTS_COLLECTION].count_documents({"author.userId": user_id, "status": POST_STATUS_POSTED})
        return count

    async def find_latest_posted(self, take: int, skip: int) -> List[Dict[str, Any]]:
        """Include stats in feed response — eliminates N+1 stat requests."""
        mongo = get_mongo()
        cursor = (
            mongo.db[POSTS_COLLECTION]
            .find({"status": POST_STATUS_POSTED})
            .sort("createdAt", -1)
            .skip(skip)
            .limit(take)
        )
        return [d async for d in cursor]

    async def find_by_user_id(self, user_id: str, take: int, skip: int) -> List[Dict[str, Any]]:
        """Show all uploader posts (pending + posted) so they can see their own drafts."""
        mongo = get_mongo()
        cursor = (
            mongo.db[POSTS_COLLECTION]
            .find({"author.userId": user_id})
            .sort("createdAt", -1)
            .skip(skip)
            .limit(take)
        )
        return [d async for d in cursor]

    async def search(self, query: str, take: int, skip: int) -> List[Dict[str, Any]]:
        """Full-text search across caption, description and tags."""
        mongo = get_mongo()
        cursor = (
            mongo.db[POSTS_COLLECTION]
            .find(
                {"$text": {"$search": query}, "status": POST_STATUS_POSTED},
                {"score": {"$meta": "textScore"}},
            )
            .sort([("score", {"$meta": "textScore"}), ("createdAt", DESCENDING)])
            .skip(skip)
            .limit(take)
        )
        return [d async for d in cursor]

    async def soft_delete(self, post_id: str) -> None:
        """Mark post as deleted — it disappears from the feed but stays in DB."""
        mongo = get_mongo()
        await mongo.db[POSTS_COLLECTION].update_one({"id": post_id}, {"$set": {"status": "deleted"}})

    async def hard_delete(self, post_id: str) -> None:
        """Permanently remove post document."""
        mongo = get_mongo()
        await mongo.db[POSTS_COLLECTION].delete_one({"id": post_id})

    async def find_by_id(self, post_id: str) -> Optional[Dict[str, Any]]:
        mongo = get_mongo()
        return await mongo.db[POSTS_COLLECTION].find_one({"id": post_id})


    async def find_by_ids(self, post_ids: List[str]) -> List[Dict[str, Any]]:
        """Batch fetch posted posts by id list — avoids N+1 for saved posts."""
        if not post_ids:
            return []
        mongo = get_mongo()
        cursor = mongo.db[POSTS_COLLECTION].find({"id": {"$in": post_ids}, "status": POST_STATUS_POSTED})
        docs = {d["id"]: d async for d in cursor}
        # Preserve the original ordering from post_ids
        return [docs[pid] for pid in post_ids if pid in docs]

    async def set_status(self, post_id: str, status: str) -> None:
        mongo = get_mongo()
        await mongo.db[POSTS_COLLECTION].update_one({"id": post_id}, {"$set": {"status": status}})

    async def update_media(self, post_id: str, media_items: List[Dict[str, Any]]) -> None:
        mongo = get_mongo()
        await mongo.db[POSTS_COLLECTION].update_one({"id": post_id}, {"$set": {"media": media_items}})

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
    async def ensure_indexes(self) -> None:
        mongo = get_mongo()
        col = mongo.db[LIKES_COLLECTION]
        await col.create_index([("postId", ASCENDING), ("userId", ASCENDING)], unique=True, background=True)
        await col.create_index([("userId", ASCENDING)], background=True)

    async def toggle(self, post_id: str, user_id: str, now: datetime) -> bool:
        mongo = get_mongo()
        existing = await mongo.db[LIKES_COLLECTION].find_one({"postId": post_id, "userId": user_id})
        if existing:
            await mongo.db[LIKES_COLLECTION].delete_one({"_id": existing["_id"]})
            return False
        await mongo.db[LIKES_COLLECTION].insert_one({"postId": post_id, "userId": user_id, "createdAt": now})
        return True


    async def list_liked_post_ids(self, user_id: str, post_ids: List[str]) -> List[str]:
        if not post_ids:
            return []
        mongo = get_mongo()
        cursor = mongo.db[LIKES_COLLECTION].find({"userId": user_id, "postId": {"$in": post_ids}}, {"_id": 0, "postId": 1})
        return [d["postId"] async for d in cursor]


@dataclass
class SavedPostsRepository:
    async def ensure_indexes(self) -> None:
        mongo = get_mongo()
        col = mongo.db[SAVED_POSTS_COLLECTION]
        await col.create_index([("userId", ASCENDING), ("createdAt", DESCENDING)], background=True)
        await col.create_index([("postId", ASCENDING), ("userId", ASCENDING)], unique=True, background=True)

    async def toggle(self, post_id: str, user_id: str, now: datetime) -> bool:
        mongo = get_mongo()
        existing = await mongo.db[SAVED_POSTS_COLLECTION].find_one({"postId": post_id, "userId": user_id})
        if existing:
            await mongo.db[SAVED_POSTS_COLLECTION].delete_one({"_id": existing["_id"]})
            return False
        await mongo.db[SAVED_POSTS_COLLECTION].insert_one({"postId": post_id, "userId": user_id, "createdAt": now})
        return True

    async def list_saved_post_ids(self, user_id: str, take: int, skip: int) -> List[str]:
        mongo = get_mongo()
        cursor = (
            mongo.db[SAVED_POSTS_COLLECTION]
            .find({"userId": user_id}, {"_id": 0, "postId": 1})
            .sort("createdAt", -1)
            .skip(skip)
            .limit(take)
        )
        return [d["postId"] async for d in cursor]

    async def count_saved_posts(self, user_id: str) -> int:
        mongo = get_mongo()
        return await mongo.db[SAVED_POSTS_COLLECTION].count_documents({"userId": user_id})

    async def list_saved_post_ids_for_posts(self, user_id: str, post_ids: List[str]) -> List[str]:
        if not post_ids:
            return []
        mongo = get_mongo()
        cursor = mongo.db[SAVED_POSTS_COLLECTION].find({"userId": user_id, "postId": {"$in": post_ids}}, {"_id": 0, "postId": 1})
        return [d["postId"] async for d in cursor]


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

