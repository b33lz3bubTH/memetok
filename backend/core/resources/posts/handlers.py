from __future__ import annotations

from typing import Any, Dict, TypeVar

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError
from pymongo.errors import PyMongoError

from core.logger.logger import get_logger
from core.resources.posts.access_control import get_access_control_service
from core.resources.posts.actions import PostsMutationAction, PostsQueryAction
from core.resources.posts.dtos import (
    AddCommentPayloadDTO,
    PaginationPayloadDTO,
    PostCommentsPayloadDTO,
    PostIdPayloadDTO,
    SearchPostsPayloadDTO,
)
from core.resources.posts.exceptions import PostNotFoundError
from core.resources.posts.service import PostsService
from core.resources.posts.upload_errors_repository import UploadErrorsRepository
from core.services.cqrs.handler_registry import Payload, mutation_registry, query_registry

logger = get_logger(__name__)


PayloadDTO = TypeVar("PayloadDTO", bound=BaseModel)


def _parse_payload(payload_model: type[PayloadDTO], payload: Payload) -> PayloadDTO:
    try:
        return payload_model.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


def register_posts_handlers(svc: PostsService, errors_repo: UploadErrorsRepository) -> None:
    async def handle_list_posts(payload: Payload) -> Dict[str, Any]:
        try:
            req = _parse_payload(PaginationPayloadDTO, payload)
            take = max(1, min(req.take, 50))
            skip = max(0, req.skip)
            user_id = req.auth.user.user_id if req.auth.user else None
            logger.info("list_posts take=%s skip=%s user_id=%s", take, skip, user_id)
            items = await svc.list_posts(take=take, skip=skip, user_id=user_id)
            return {"items": [i.model_dump() for i in items], "take": take, "skip": skip, "total": None}
        except PyMongoError as e:
            logger.exception("list_posts db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    async def handle_get_post(payload: Payload) -> Dict[str, Any]:
        try:
            req = _parse_payload(PostIdPayloadDTO, payload)
            user_id = req.auth.user.user_id if req.auth.user else None
            logger.info("get_post post_id=%s user_id=%s", req.postId, user_id)
            post = await svc.get_post(post_id=req.postId, user_id=user_id)
            return post.model_dump()
        except PostNotFoundError as e:
            logger.info("get_post not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e

    async def handle_list_user_posts(payload: Payload) -> Dict[str, Any]:
        try:
            req = _parse_payload(PaginationPayloadDTO, payload)
            if not req.auth.authenticated or not req.auth.user:
                raise HTTPException(status_code=401, detail="authentication required")

            user = req.auth.user
            user_id = user.user_id
            email = user.email or req.email
            if isinstance(email, str):
                email = email.lower()

            access_service = get_access_control_service()
            is_uploader = await access_service.is_uploader_user(email)
            if not is_uploader:
                raise HTTPException(status_code=403, detail="my posts is only available for uploaders")
            take = max(1, min(req.take, 100))
            skip = max(0, req.skip)
            logger.info("list_user_posts user_id=%s take=%s skip=%s", user_id, take, skip)
            items = await svc.list_posts_by_user(user_id=user_id, take=take, skip=skip)
            total = await svc.count_posts_by_user(user_id=user_id)
            return {"items": [i.model_dump() for i in items], "take": take, "skip": skip, "total": total}
        except PyMongoError as e:
            logger.exception("list_user_posts db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    async def handle_list_saved_posts(payload: Payload) -> Dict[str, Any]:
        try:
            req = _parse_payload(PaginationPayloadDTO, payload)
            user_id = req.auth.user.user_id if req.auth.user else ""
            if not user_id:
                raise HTTPException(status_code=401, detail="authentication required")
            take = max(1, min(req.take, 100))
            skip = max(0, req.skip)
            logger.info("list_saved_posts user_id=%s take=%s skip=%s", user_id, take, skip)
            items = await svc.list_saved_posts(user_id=user_id, take=take, skip=skip)
            total = await svc.count_saved_posts(user_id=user_id)
            return {"items": [i.model_dump() for i in items], "take": take, "skip": skip, "total": total}
        except PyMongoError as e:
            logger.exception("list_saved_posts db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    async def handle_get_post_stats(payload: Payload) -> Dict[str, Any]:
        try:
            req = _parse_payload(PostIdPayloadDTO, payload)
            logger.info("get_post_stats post_id=%s", req.postId)
            stats = await svc.get_post_stats(post_id=req.postId)
            return {"stats": stats.model_dump()}
        except PostNotFoundError as e:
            logger.info("get_post_stats not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e

    async def handle_list_comments(payload: Payload) -> Dict[str, Any]:
        try:
            req = _parse_payload(PostCommentsPayloadDTO, payload)
            take = max(1, min(req.take, 50))
            skip = max(0, req.skip)
            logger.info("list_comments post_id=%s take=%s skip=%s", req.postId, take, skip)
            items = await svc.list_comments(post_id=req.postId, take=take, skip=skip)
            return {"items": [i.model_dump() for i in items], "take": take, "skip": skip}
        except PostNotFoundError as e:
            logger.info("list_comments not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e

    async def handle_toggle_like(payload: Payload) -> Dict[str, Any]:
        try:
            req = _parse_payload(PostIdPayloadDTO, payload)
            user_id = req.auth.user.user_id if req.auth.user else ""
            if not user_id:
                raise HTTPException(status_code=401, detail="authentication required")
            logger.info("toggle_like post_id=%s user_id=%s", req.postId, user_id)
            liked, likes = await svc.toggle_like(post_id=req.postId, user_id=user_id)
            return {"postId": req.postId, "liked": liked, "likes": likes}
        except PostNotFoundError as e:
            logger.info("toggle_like not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e

    async def handle_toggle_save_post(payload: Payload) -> Dict[str, Any]:
        try:
            req = _parse_payload(PostIdPayloadDTO, payload)
            user_id = req.auth.user.user_id if req.auth.user else ""
            if not user_id:
                raise HTTPException(status_code=401, detail="authentication required")
            logger.info("toggle_save_post post_id=%s user_id=%s", req.postId, user_id)
            saved = await svc.toggle_save_post(post_id=req.postId, user_id=user_id)
            return {"postId": req.postId, "saved": saved}
        except PostNotFoundError as e:
            logger.info("toggle_save_post not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e

    async def handle_add_comment(payload: Payload) -> Dict[str, Any]:
        try:
            req = _parse_payload(AddCommentPayloadDTO, payload)
            user_id = req.auth.user.user_id if req.auth.user else ""
            if not user_id:
                raise HTTPException(status_code=401, detail="authentication required")
            logger.info("add_comment post_id=%s user_id=%s first_name=%s", req.postId, user_id, req.firstName)
            comment = await svc.add_comment(post_id=req.postId, user_id=user_id, text=req.text, first_name=req.firstName)
            return comment.model_dump()
        except PostNotFoundError as e:
            logger.info("add_comment not found post_id=%s", payload.get("postId"))
            raise HTTPException(status_code=404, detail="post not found") from e

    async def handle_search_posts(payload: Payload) -> Dict[str, Any]:
        try:
            req = _parse_payload(SearchPostsPayloadDTO, payload)
            take = max(1, min(req.take, 50))
            skip = max(0, req.skip)
            logger.info("search_posts query=%r take=%s skip=%s", req.query, take, skip)
            items = await svc.search_posts(query=req.query, take=take, skip=skip)
            return {"items": [i.model_dump() for i in items], "take": take, "skip": skip}
        except PyMongoError as e:
            logger.exception("search_posts db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    async def handle_delete_post(payload: Payload) -> Dict[str, Any]:
        req = _parse_payload(PostIdPayloadDTO, payload)
        user_id = req.auth.user.user_id if req.auth.user else ""
        is_super_admin = req.auth.is_super_admin
        if not user_id and not is_super_admin:
            raise HTTPException(status_code=401, detail="authentication required")

        try:
            logger.info("delete_post post_id=%s user_id=%s is_admin=%s", req.postId, user_id, is_super_admin)
            await svc.delete_post(post_id=req.postId, requesting_user_id=user_id, is_admin=is_super_admin)
            return {"postId": req.postId, "deleted": True}
        except PostNotFoundError as e:
            logger.info("delete_post not found post_id=%s", req.postId)
            raise HTTPException(status_code=404, detail="post not found") from e
        except PermissionError as e:
            logger.warning("delete_post forbidden post_id=%s user_id=%s", req.postId, user_id)
            raise HTTPException(status_code=403, detail=str(e)) from e

    async def handle_list_upload_errors(payload: Payload) -> Dict[str, Any]:
        try:
            req = _parse_payload(PaginationPayloadDTO, payload)
            if not req.auth.authenticated or not req.auth.user:
                raise HTTPException(status_code=401, detail="authentication required")

            user = req.auth.user
            user_id = user.user_id
            email = user.email or req.email
            if isinstance(email, str):
                email = email.lower()

            access_service = get_access_control_service()
            is_uploader = await access_service.is_uploader_user(email)
            if not is_uploader:
                raise HTTPException(status_code=403, detail="upload logs are only available for uploaders")

            take = max(1, min(req.take, 100))
            skip = max(0, req.skip)

            logger.info("list_upload_errors user_id=%s take=%s skip=%s", user_id, take, skip)
            items = await errors_repo.find_by_user_id(user_id=user_id, limit=take, skip=skip)
            total = await errors_repo.count_by_user_id(user_id=user_id)

            result_items = []
            for item in items:
                clean_item: Dict[str, Any] = {k: v for k, v in item.items() if k != "_id"}
                ca = clean_item.get("createdAt")
                if ca and hasattr(ca, "isoformat"):
                    clean_item["createdAt"] = ca.isoformat()
                result_items.append(clean_item)

            return {"items": result_items, "take": take, "skip": skip, "total": total}
        except PyMongoError as e:
            logger.exception("list_upload_errors db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    async def handle_list_all_upload_errors(payload: Payload) -> Dict[str, Any]:
        try:
            req = _parse_payload(PaginationPayloadDTO, payload)
            if not req.auth.is_super_admin:
                raise HTTPException(status_code=403, detail="Super admin access required")

            take = max(1, min(req.take, 100))
            skip = max(0, req.skip)

            logger.info("list_all_upload_errors take=%s skip=%s", take, skip)
            items = await errors_repo.find_all(limit=take, skip=skip)
            total = await errors_repo.count_all()

            result_items = []
            for item in items:
                clean_item: Dict[str, Any] = {k: v for k, v in item.items() if k != "_id"}
                clean_item["id"] = str(item["_id"])
                ca = clean_item.get("createdAt")
                if ca and hasattr(ca, "isoformat"):
                    clean_item["createdAt"] = ca.isoformat()
                result_items.append(clean_item)

            return {"items": result_items, "take": take, "skip": skip, "total": total}
        except PyMongoError as e:
            logger.exception("list_all_upload_errors db error")
            raise HTTPException(status_code=503, detail="db unavailable") from e

    query_registry.register(PostsQueryAction.LIST_POSTS, handle_list_posts)
    query_registry.register(PostsQueryAction.GET_POST, handle_get_post)
    query_registry.register(PostsQueryAction.LIST_USER_POSTS, handle_list_user_posts)
    query_registry.register(PostsQueryAction.GET_POST_STATS, handle_get_post_stats)
    query_registry.register(PostsQueryAction.LIST_COMMENTS, handle_list_comments)
    query_registry.register(PostsQueryAction.LIST_SAVED_POSTS, handle_list_saved_posts)
    query_registry.register(PostsQueryAction.SEARCH_POSTS, handle_search_posts)
    query_registry.register(PostsQueryAction.LIST_UPLOAD_ERRORS, handle_list_upload_errors)
    query_registry.register(PostsQueryAction.LIST_ALL_UPLOAD_ERRORS, handle_list_all_upload_errors)

    mutation_registry.register(PostsMutationAction.TOGGLE_LIKE, handle_toggle_like)
    mutation_registry.register(PostsMutationAction.ADD_COMMENT, handle_add_comment)
    mutation_registry.register(PostsMutationAction.TOGGLE_SAVE_POST, handle_toggle_save_post)
    mutation_registry.register(PostsMutationAction.DELETE_POST, handle_delete_post)
