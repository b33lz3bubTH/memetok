from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import PyMongoError

from core.logger.logger import get_logger
from core.plugins.auth.deps import get_current_user
from core.resources.jobs.shared import get_shared_jobs_service
from core.resources.posts.buses import register_posts_buses
from core.resources.posts.dtos import (
    CommentCreateRequest,
    ListCommentsResponse,
    ListPostsResponse,
    ToggleLikeResponse,
    CreatePostRequest,
)
from core.resources.posts.exceptions import PostNotFoundError
from core.resources.posts.repositories import CommentsRepository, LikesRepository, PostsRepository
from core.resources.posts.service import PostsService


router = APIRouter(tags=["posts"])
logger = get_logger(__name__)


def _get_posts_service() -> PostsService:
    jobs_service = get_shared_jobs_service()
    return PostsService(
        posts_repo=PostsRepository(),
        likes_repo=LikesRepository(),
        comments_repo=CommentsRepository(),
        jobs_service=jobs_service,
    )


_svc = _get_posts_service()
register_posts_buses(_svc)


@router.get("/posts", response_model=ListPostsResponse)
async def list_posts(
    take: int = Query(default=10, ge=1, le=50),
    skip: int = Query(default=0, ge=0),
):
    try:
        logger.info("list_posts take=%s skip=%s", take, skip)
        items = await _svc.list_posts(take=take, skip=skip)
        return {"items": items, "take": take, "skip": skip}
    except PyMongoError as e:
        logger.exception("list_posts db error")
        raise HTTPException(status_code=503, detail="db unavailable") from e


@router.post("/posts")
async def create_post(req: CreatePostRequest, user=Depends(get_current_user)):
    logger.info("create_post user_id=%s media_id=%s media_type=%s", user.user_id, req.mediaId, req.mediaType)
    post = await _svc.create_post(
        user_id=user.user_id,
        media_id=req.mediaId,
        media_type=req.mediaType,
        caption=req.caption,
        tags=req.tags,
    )
    return post


@router.post("/posts/{post_id}/like", response_model=ToggleLikeResponse)
async def toggle_like(post_id: str, user=Depends(get_current_user)):
    try:
        logger.info("toggle_like post_id=%s user_id=%s", post_id, user.user_id)
        liked, likes = await _svc.toggle_like(post_id=post_id, user_id=user.user_id)
        return {"postId": post_id, "liked": liked, "likes": likes}
    except PostNotFoundError as e:
        logger.info("toggle_like not found post_id=%s", post_id)
        raise HTTPException(status_code=404, detail="post not found") from e


@router.get("/posts/{post_id}/comments", response_model=ListCommentsResponse)
async def list_comments(
    post_id: str,
    take: int = Query(default=20, ge=1, le=50),
    skip: int = Query(default=0, ge=0),
):
    try:
        logger.info("list_comments post_id=%s take=%s skip=%s", post_id, take, skip)
        items = await _svc.list_comments(post_id=post_id, take=take, skip=skip)
        return {"items": items, "take": take, "skip": skip}
    except PostNotFoundError as e:
        logger.info("list_comments not found post_id=%s", post_id)
        raise HTTPException(status_code=404, detail="post not found") from e


@router.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, req: CommentCreateRequest, user=Depends(get_current_user)):
    try:
        logger.info("add_comment post_id=%s user_id=%s", post_id, user.user_id)
        return await _svc.add_comment(post_id=post_id, user_id=user.user_id, text=req.text)
    except PostNotFoundError as e:
        logger.info("add_comment not found post_id=%s", post_id)
        raise HTTPException(status_code=404, detail="post not found") from e

