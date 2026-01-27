from __future__ import annotations

from dataclasses import dataclass
from typing import List
from uuid import uuid4

from common.app_constants import POST_STATUS_PENDING
from database.mongo_common import now_utc
from core.resources.jobs.service import JobsService
from core.resources.posts.dtos import CommentDTO, MediaType, MediaItem, PostDTO, PostListDTO, PostStatsDTO
from core.resources.posts.exceptions import PostNotFoundError
from core.resources.posts.repositories import CommentsRepository, LikesRepository, PostsRepository
from core.resources.posts.validators import normalize_tags
from core.logger.logger import get_logger


logger = get_logger(__name__)


@dataclass
class PostsService:
    posts_repo: PostsRepository
    likes_repo: LikesRepository
    comments_repo: CommentsRepository
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

    async def list_posts(self, take: int, skip: int) -> List[PostListDTO]:
        docs = await self.posts_repo.find_latest_posted(take=take, skip=skip)
        logger.info("list_posts ok take=%s skip=%s count=%s", take, skip, len(docs))
        return [PostListDTO.model_validate(d) for d in docs]

    async def list_posts_by_user(self, user_id: str, take: int, skip: int) -> List[PostListDTO]:
        docs = await self.posts_repo.find_by_user_id(user_id=user_id, take=take, skip=skip)
        logger.info("list_posts_by_user user_id=%s take=%s skip=%s count=%s", user_id, take, skip, len(docs))
        return [PostListDTO.model_validate(d) for d in docs]

    async def count_posts_by_user(self, user_id: str) -> int:
        return await self.posts_repo.count_posts_by_user(user_id=user_id)

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

    async def add_comment(self, post_id: str, user_id: str, text: str) -> CommentDTO:
        post = await self.posts_repo.find_by_id(post_id)
        if not post:
            raise PostNotFoundError()

        now = now_utc()
        comment_id = str(uuid4())
        doc = {"id": comment_id, "postId": post_id, "userId": user_id, "text": text, "createdAt": now}
        await self.comments_repo.insert(doc)
        await self.posts_repo.inc_counts(post_id=post_id, comments_delta=1)
        return CommentDTO.model_validate(doc)

    async def list_comments(self, post_id: str, take: int, skip: int) -> List[CommentDTO]:
        post = await self.posts_repo.find_by_id(post_id)
        if not post:
            raise PostNotFoundError()

        docs = await self.comments_repo.find_latest(post_id=post_id, take=take, skip=skip)
        return [CommentDTO.model_validate(d) for d in docs]

