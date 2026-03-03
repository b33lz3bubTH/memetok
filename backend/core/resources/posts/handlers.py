from __future__ import annotations

from typing import Any, Dict
from pymongo.errors import PyMongoError

from fastapi import HTTPException

from core.logger.logger import get_logger
from core.resources.posts.actions import PostsQueryAction, PostsMutationAction
from core.resources.posts.service import PostsService
from core.resources.posts.exceptions import PostNotFoundError
from core.resources.posts.access_control import get_access_control_service
from core.services.cqrs.handler_registry import query_registry, mutation_registry


logger = get_logger(__name__)


def register_posts_handlers(svc: PostsService) -> None:
    async def handle_list_posts(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            take = int(payload.get("take", 10))
            skip = int(payload.get("skip", 0))
            take = max(1, min(take, 50))
            skip = max(0, skip)
            logger.info("list_posts take=%s skip=%s", take, skip)
            items = await svc.list_posts(take=take, skip=skip)
            return {"items": [i.model_dump() for i in items], "take": take, "skip": skip, "total": None}
        except PyMongoError as e:
            logger.exception("list_posts db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    async def handle_get_post(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            post_id = str(payload.get("postId", ""))
            if not post_id:
                raise HTTPException(status_code=400, detail="postId is required")
            logger.info("get_post post_id=%s", post_id)
            post = await svc.get_post(post_id=post_id)
            return post.model_dump()
        except PostNotFoundError as e:
            logger.info("get_post not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e

    async def handle_list_user_posts(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            if not payload.get("__auth"):
                raise HTTPException(status_code=401, detail="authentication required")
            user_id = str(payload.get("userId", ""))
            if not user_id:
                raise HTTPException(status_code=400, detail="userId is required")
            access_service = get_access_control_service()
            is_uploader = await access_service.is_uploader_user(user_id)
            if not is_uploader:
                raise HTTPException(status_code=403, detail="my posts is only available for uploaders")
            take = int(payload.get("take", 50))
            skip = int(payload.get("skip", 0))
            take = max(1, min(take, 100))
            skip = max(0, skip)
            logger.info("list_user_posts user_id=%s take=%s skip=%s", user_id, take, skip)
            items = await svc.list_posts_by_user(user_id=user_id, take=take, skip=skip)
            total = await svc.count_posts_by_user(user_id=user_id)
            return {"items": [i.model_dump() for i in items], "take": take, "skip": skip, "total": total}
        except PyMongoError as e:
            logger.exception("list_user_posts db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e



    async def handle_list_saved_posts(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            user_id = str(payload.get("userId", ""))
            if not user_id:
                raise HTTPException(status_code=401, detail="authentication required")
            take = int(payload.get("take", 50))
            skip = int(payload.get("skip", 0))
            take = max(1, min(take, 100))
            skip = max(0, skip)
            logger.info("list_saved_posts user_id=%s take=%s skip=%s", user_id, take, skip)
            items = await svc.list_saved_posts(user_id=user_id, take=take, skip=skip)
            total = await svc.count_saved_posts(user_id=user_id)
            return {"items": [i.model_dump() for i in items], "take": take, "skip": skip, "total": total}
        except PyMongoError as e:
            logger.exception("list_saved_posts db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    async def handle_get_post_stats(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            post_id = str(payload.get("postId", ""))
            if not post_id:
                raise HTTPException(status_code=400, detail="postId is required")
            logger.info("get_post_stats post_id=%s", post_id)
            stats = await svc.get_post_stats(post_id=post_id)
            return {"stats": stats.model_dump()}
        except PostNotFoundError as e:
            logger.info("get_post_stats not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e

    async def handle_list_comments(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            post_id = str(payload.get("postId", ""))
            if not post_id:
                raise HTTPException(status_code=400, detail="postId is required")
            take = int(payload.get("take", 20))
            skip = int(payload.get("skip", 0))
            take = max(1, min(take, 50))
            skip = max(0, skip)
            logger.info("list_comments post_id=%s take=%s skip=%s", post_id, take, skip)
            items = await svc.list_comments(post_id=post_id, take=take, skip=skip)
            return {"items": [i.model_dump() for i in items], "take": take, "skip": skip}
        except PostNotFoundError as e:
            logger.info("list_comments not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e

    async def handle_toggle_like(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            post_id = str(payload.get("postId", ""))
            user_id = str(payload.get("userId", ""))
            if not post_id:
                raise HTTPException(status_code=400, detail="postId is required")
            if not user_id:
                raise HTTPException(status_code=400, detail="userId is required")
            logger.info("toggle_like post_id=%s user_id=%s", post_id, user_id)
            liked, likes = await svc.toggle_like(post_id=post_id, user_id=user_id)
            return {"postId": post_id, "liked": liked, "likes": likes}
        except PostNotFoundError as e:
            logger.info("toggle_like not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e



    async def handle_toggle_save_post(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            post_id = str(payload.get("postId", ""))
            user_id = str(payload.get("userId", ""))
            if not post_id:
                raise HTTPException(status_code=400, detail="postId is required")
            if not user_id:
                raise HTTPException(status_code=401, detail="authentication required")
            logger.info("toggle_save_post post_id=%s user_id=%s", post_id, user_id)
            saved = await svc.toggle_save_post(post_id=post_id, user_id=user_id)
            return {"postId": post_id, "saved": saved}
        except PostNotFoundError as e:
            logger.info("toggle_save_post not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e

    async def handle_add_comment(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            post_id = str(payload.get("postId", ""))
            user_id = str(payload.get("userId", ""))
            text = str(payload.get("text", ""))
            if not post_id:
                raise HTTPException(status_code=400, detail="postId is required")
            if not user_id:
                raise HTTPException(status_code=400, detail="userId is required")
            if not text:
                raise HTTPException(status_code=400, detail="text is required")
            logger.info("add_comment post_id=%s user_id=%s", post_id, user_id)
            comment = await svc.add_comment(post_id=post_id, user_id=user_id, text=text)
            return comment.model_dump()
        except PostNotFoundError as e:
            logger.info("add_comment not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e

    query_registry.register(PostsQueryAction.LIST_POSTS, handle_list_posts)
    query_registry.register(PostsQueryAction.GET_POST, handle_get_post)
    query_registry.register(PostsQueryAction.LIST_USER_POSTS, handle_list_user_posts)
    query_registry.register(PostsQueryAction.GET_POST_STATS, handle_get_post_stats)
    query_registry.register(PostsQueryAction.LIST_COMMENTS, handle_list_comments)
    query_registry.register(PostsQueryAction.LIST_SAVED_POSTS, handle_list_saved_posts)

    mutation_registry.register(PostsMutationAction.TOGGLE_LIKE, handle_toggle_like)
    mutation_registry.register(PostsMutationAction.ADD_COMMENT, handle_add_comment)
    mutation_registry.register(PostsMutationAction.TOGGLE_SAVE_POST, handle_toggle_save_post)
