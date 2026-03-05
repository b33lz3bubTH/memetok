from __future__ import annotations

from typing import Any, Dict
from pymongo.errors import PyMongoError

from fastapi import HTTPException

from core.logger.logger import get_logger
from core.resources.posts.actions import PostsQueryAction, PostsMutationAction
from core.resources.posts.service import PostsService
from core.resources.posts.exceptions import PostNotFoundError
from core.resources.posts.access_control import get_access_control_service
from core.resources.posts.upload_errors_repository import UploadErrorsRepository
from core.services.cqrs.handler_registry import query_registry, mutation_registry


logger = get_logger(__name__)


def register_posts_handlers(svc: PostsService, errors_repo: UploadErrorsRepository) -> None:
    async def handle_list_posts(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            take = int(payload.get("take", 10))
            skip = int(payload.get("skip", 0))
            take = max(1, min(take, 50))
            skip = max(0, skip)
            auth = payload.get("__auth", {})
            user = auth.get("user") if isinstance(auth, dict) else None
            user_id = user.user_id if user else None
            logger.info("list_posts take=%s skip=%s user_id=%s", take, skip, user_id)
            items = await svc.list_posts(take=take, skip=skip, user_id=user_id)
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
            auth = payload.get("__auth", {})
            authenticated = auth.get("authenticated", False) if isinstance(auth, dict) else bool(auth)
            if not authenticated:
                raise HTTPException(status_code=401, detail="authentication required")
            user = auth.get("user")
            if not user:
                raise HTTPException(status_code=401, detail="authentication required")
            
            user_id = user.user_id
            email = user.email or payload.get("email")
            if isinstance(email, str):
                email = email.lower()
            
            access_service = get_access_control_service()
            is_uploader = await access_service.is_uploader_user(email)
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
            auth = payload.get("__auth", {})
            user = auth.get("user") if isinstance(auth, dict) else None
            user_id = user.user_id if user else ""
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
            auth = payload.get("__auth", {})
            user = auth.get("user") if isinstance(auth, dict) else None
            user_id = user.user_id if user else ""
            if not post_id:
                raise HTTPException(status_code=400, detail="postId is required")
            if not user_id:
                raise HTTPException(status_code=401, detail="authentication required")
            logger.info("toggle_like post_id=%s user_id=%s", post_id, user_id)
            liked, likes = await svc.toggle_like(post_id=post_id, user_id=user_id)
            return {"postId": post_id, "liked": liked, "likes": likes}
        except PostNotFoundError as e:
            logger.info("toggle_like not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e



    async def handle_toggle_save_post(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            post_id = str(payload.get("postId", ""))
            auth = payload.get("__auth", {})
            user = auth.get("user") if isinstance(auth, dict) else None
            user_id = user.user_id if user else ""
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
            auth = payload.get("__auth", {})
            user = auth.get("user") if isinstance(auth, dict) else None
            user_id = user.user_id if user else ""
            text = str(payload.get("text", ""))
            first_name = payload.get("firstName")
            if not post_id:
                raise HTTPException(status_code=400, detail="postId is required")
            if not user_id:
                raise HTTPException(status_code=401, detail="authentication required")
            if not text:
                raise HTTPException(status_code=400, detail="text is required")
            logger.info("add_comment post_id=%s user_id=%s first_name=%s", post_id, user_id, first_name)
            comment = await svc.add_comment(post_id=post_id, user_id=user_id, text=text, first_name=first_name)
            return comment.model_dump()
        except PostNotFoundError as e:
            logger.info("add_comment not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e
            
    async def handle_search_posts(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            query = str(payload.get("query", ""))
            take = int(payload.get("take", 20))
            skip = int(payload.get("skip", 0))
            take = max(1, min(take, 50))
            skip = max(0, skip)
            logger.info("search_posts query=%r take=%s skip=%s", query, take, skip)
            items = await svc.search_posts(query=query, take=take, skip=skip)
            return {"items": [i.model_dump() for i in items], "take": take, "skip": skip}
        except PyMongoError as e:
            logger.exception("search_posts db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    async def handle_delete_post(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            post_id = str(payload.get("postId", ""))
            if not post_id:
                raise HTTPException(status_code=400, detail="postId is required")

            auth = payload.get("__auth", {})
            user = auth.get("user") if isinstance(auth, dict) else None
            user_id = user.user_id if user else ""
            is_super_admin = auth.get("is_super_admin", False) if isinstance(auth, dict) else False

            if not user_id and not is_super_admin:
                raise HTTPException(status_code=401, detail="authentication required")

            logger.info("delete_post post_id=%s user_id=%s is_admin=%s", post_id, user_id, is_super_admin)
            await svc.delete_post(post_id=post_id, requesting_user_id=user_id, is_admin=is_super_admin)
            return {"postId": post_id, "deleted": True}
        except PostNotFoundError as e:
            logger.info("delete_post not found post_id=%s", post_id)
            raise HTTPException(status_code=404, detail="post not found") from e
        except PermissionError as e:
            logger.warning("delete_post forbidden post_id=%s user_id=%s", post_id, user_id)
            raise HTTPException(status_code=403, detail=str(e)) from e

    async def handle_list_upload_errors(payload: Dict[str, Any]) -> Dict[str, Any]:
        try:
            auth = payload.get("__auth", {})
            authenticated = auth.get("authenticated", False) if isinstance(auth, dict) else bool(auth)
            if not authenticated:
                raise HTTPException(status_code=401, detail="authentication required")
            user = auth.get("user")
            if not user:
                raise HTTPException(status_code=401, detail="authentication required")

            user_id = user.user_id
            email = user.email or payload.get("email")
            if isinstance(email, str):
                email = email.lower()

            access_service = get_access_control_service()
            is_uploader = await access_service.is_uploader_user(email)
            if not is_uploader:
                raise HTTPException(status_code=403, detail="upload logs are only available for uploaders")

            take = int(payload.get("take", 50))
            skip = int(payload.get("skip", 0))
            take = max(1, min(take, 100))
            skip = max(0, skip)

            logger.info("list_upload_errors user_id=%s take=%s skip=%s", user_id, take, skip)
            items = await errors_repo.find_by_user_id(user_id=user_id, limit=take, skip=skip)
            total = await errors_repo.count_by_user_id(user_id=user_id)

            # Convert MongoDB dicts (with _id) to clean dicts for API
            result_items = []
            for item in items:
                clean_item = {k: v for k, v in item.items() if k != "_id"}
                if "createdAt" in clean_item and not isinstance(clean_item["createdAt"], str):
                    clean_item["createdAt"] = clean_item["createdAt"].isoformat()
                result_items.append(clean_item)

            return {"items": result_items, "take": take, "skip": skip, "total": total}
        except PyMongoError as e:
            logger.exception("list_upload_errors db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    query_registry.register(PostsQueryAction.LIST_POSTS, handle_list_posts)
    query_registry.register(PostsQueryAction.GET_POST, handle_get_post)
    query_registry.register(PostsQueryAction.LIST_USER_POSTS, handle_list_user_posts)
    query_registry.register(PostsQueryAction.GET_POST_STATS, handle_get_post_stats)
    query_registry.register(PostsQueryAction.LIST_COMMENTS, handle_list_comments)
    query_registry.register(PostsQueryAction.LIST_SAVED_POSTS, handle_list_saved_posts)
    query_registry.register(PostsQueryAction.SEARCH_POSTS, handle_search_posts)
    query_registry.register(PostsQueryAction.LIST_UPLOAD_ERRORS, handle_list_upload_errors)

    mutation_registry.register(PostsMutationAction.TOGGLE_LIKE, handle_toggle_like)
    mutation_registry.register(PostsMutationAction.ADD_COMMENT, handle_add_comment)
    mutation_registry.register(PostsMutationAction.TOGGLE_SAVE_POST, handle_toggle_save_post)
    mutation_registry.register(PostsMutationAction.DELETE_POST, handle_delete_post)
