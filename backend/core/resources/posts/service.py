from __future__ import annotations

from dataclasses import dataclass
from typing import List
from uuid import uuid4

from common.app_constants import POST_STATUS_PENDING
from database.mongo_common import now_utc
from core.resources.jobs.service import JobsService
from core.resources.posts.dtos import CommentDTO, MediaType, MediaItem, PostDTO, PostListDTO, PostStatsDTO
from core.resources.posts.exceptions import PostNotFoundError
from core.resources.posts.repositories import CommentsRepository, LikesRepository, PostsRepository, SavedPostsRepository
from core.resources.posts.validators import normalize_tags
from core.logger.logger import get_logger


logger = get_logger(__name__)


@dataclass
class PostsService:
    posts_repo: PostsRepository
    likes_repo: LikesRepository
    comments_repo: CommentsRepository
    saved_posts_repo: SavedPostsRepository
    jobs_service: JobsService

    async def create_post(self, user_id: str, caption: str, description: str, tags: list[str], username: str | None = None, profile_photo: str | None = None) -> PostDTO:
        now = now_utc()
        post_id = str(uuid4())
        author = {"userId": user_id}
        if username:
            author["username"] = username
        if profile_photo:
            author["profilePhoto"] = profile_photo
        doc = {
            "id": post_id,
            "media": [],
            "caption": caption,
            "description": description,
            "tags": normalize_tags(tags),
            "status": POST_STATUS_PENDING,
            "createdAt": now,
            "author": author,
            "stats": {"likes": 0, "comments": 0},
        }
        await self.posts_repo.insert(doc)
        logger.info("post created (pending) post_id=%s user_id=%s", post_id, user_id)
        return PostDTO.model_validate(doc)

    async def list_posts(self, take: int, skip: int, user_id: str | None = None) -> List[PostListDTO]:
        docs = await self.posts_repo.find_latest_posted(take=take, skip=skip)
        if user_id and docs:
            post_ids = [d.get("id") for d in docs if d.get("id")]
            liked_ids = set(await self.likes_repo.list_liked_post_ids(user_id=user_id, post_ids=post_ids))
            saved_ids = set(await self.saved_posts_repo.list_saved_post_ids_for_posts(user_id=user_id, post_ids=post_ids))
            for d in docs:
                post_id = d.get("id")
                d["likedByUser"] = post_id in liked_ids
                d["savedByUser"] = post_id in saved_ids
        logger.info("list_posts ok take=%s skip=%s count=%s", take, skip, len(docs))
        return [PostListDTO.model_validate(d) for d in docs]

    async def list_posts_by_user(self, user_id: str, take: int, skip: int) -> List[PostListDTO]:
        docs = await self.posts_repo.find_by_user_id(user_id=user_id, take=take, skip=skip)
        logger.info("list_posts_by_user user_id=%s take=%s skip=%s count=%s", user_id, take, skip, len(docs))
        return [PostListDTO.model_validate(d) for d in docs]

    async def count_posts_by_user(self, user_id: str) -> int:
        return await self.posts_repo.count_posts_by_user(user_id=user_id)



    async def list_saved_posts(self, user_id: str, take: int, skip: int) -> List[PostListDTO]:
        post_ids = await self.saved_posts_repo.list_saved_post_ids(user_id=user_id, take=take, skip=skip)
        if not post_ids:
            return []

        posts = await self.posts_repo.find_by_ids(post_ids)
        by_id = {p.get("id"): p for p in posts if p.get("status") == "posted"}
        items: List[PostListDTO] = []
        for post_id in post_ids:
            post = by_id.get(post_id)
            if not post:
                continue
            post["savedByUser"] = True
            items.append(PostListDTO.model_validate(post))
        return items

    async def count_saved_posts(self, user_id: str) -> int:
        return await self.saved_posts_repo.count_saved_posts(user_id=user_id)

    async def get_post(self, post_id: str) -> PostDTO:
        doc = await self.posts_repo.find_by_id(post_id)
        if not doc:
            raise PostNotFoundError()
        logger.info("get_post post_id=%s", post_id)
        return PostDTO.model_validate(doc)

    async def get_post_stats(self, post_id: str) -> PostStatsDTO:
        post = await self.posts_repo.find_by_id(post_id)
        if not post:
            raise PostNotFoundError()
        likes = int(post.get("stats", {}).get("likes", 0))
        comments = int(post.get("stats", {}).get("comments", 0))
        return PostStatsDTO(postId=post_id, likes=likes, comments=comments)

    async def toggle_like(self, post_id: str, user_id: str) -> tuple[bool, int]:
        post = await self.posts_repo.find_by_id(post_id)
        if not post:
            raise PostNotFoundError()

        now = now_utc()
        liked = await self.likes_repo.toggle(post_id=post_id, user_id=user_id, now=now)
        delta = 1 if liked else -1
        updated = await self.posts_repo.inc_counts(post_id=post_id, likes_delta=delta)
        likes = int((updated or post).get("stats", {}).get("likes", 0))
        return liked, likes



    async def toggle_save_post(self, post_id: str, user_id: str) -> bool:
        post = await self.posts_repo.find_by_id(post_id)
        if not post or post.get("status") != "posted":
            raise PostNotFoundError()

        now = now_utc()
        return await self.saved_posts_repo.toggle(post_id=post_id, user_id=user_id, now=now)

    async def add_comment(self, post_id: str, user_id: str, text: str, first_name: str | None = None) -> CommentDTO:
        post = await self.posts_repo.find_by_id(post_id)
        if not post:
            raise PostNotFoundError()

        # Sanitize comment text: strip control chars, enforce max length
        sanitized = "".join(ch for ch in text if ch >= " " or ch in "\n").strip()[:300]
        if not sanitized:
            raise ValueError("Comment text cannot be empty after sanitization")

        now = now_utc()
        comment_id = str(uuid4())
        doc = {
            "id": comment_id,
            "postId": post_id,
            "userId": user_id,
            "text": sanitized,
            "firstName": first_name,
            "createdAt": now,
        }
        await self.comments_repo.insert(doc)
        await self.posts_repo.inc_counts(post_id=post_id, comments_delta=1)
        return CommentDTO.model_validate(doc)

    async def delete_post(self, post_id: str, requesting_user_id: str) -> None:
        """Soft-delete a post. Only the owner can delete their own post."""
        post = await self.posts_repo.find_by_id(post_id)
        if not post:
            raise PostNotFoundError()
        if post.get("author", {}).get("userId") != requesting_user_id:
            raise PermissionError("You can only delete your own posts")
        await self.posts_repo.soft_delete(post_id)
        logger.info("post soft-deleted post_id=%s user_id=%s", post_id, requesting_user_id)

    async def search_posts(self, query: str, take: int, skip: int) -> List[PostListDTO]:
        """Search posts by text across caption, description and tags."""
        if not query or not query.strip():
            return []
        docs = await self.posts_repo.search(query=query.strip(), take=take, skip=skip)
        return [PostListDTO.model_validate(d) for d in docs]

    async def cleanup_dangling_posts(self, older_than_minutes: int = 60) -> int:
        """Mark as 'failed' any posts that have been pending for too long (upload never completed)."""
        from datetime import timedelta
        threshold = now_utc() - timedelta(minutes=older_than_minutes)
        mongo_client = self.posts_repo  # access via repo method
        # We do a direct update via the repository's set_status through a find query
        from database.mongo_factory import get_mongo
        from core.resources.posts.constants import POSTS_COLLECTION
        mongo = get_mongo()
        result = await mongo.db[POSTS_COLLECTION].update_many(
            {"status": "pending", "createdAt": {"$lt": threshold}},
            {"$set": {"status": "failed"}},
        )
        count = result.modified_count
        if count:
            logger.info("cleanup_dangling_posts marked %d posts as failed", count)
        return count

    async def list_comments(self, post_id: str, take: int, skip: int) -> List[CommentDTO]:
        post = await self.posts_repo.find_by_id(post_id)
        if not post:
            raise PostNotFoundError()

        docs = await self.comments_repo.find_latest(post_id=post_id, take=take, skip=skip)
        return [CommentDTO.model_validate(d) for d in docs]

