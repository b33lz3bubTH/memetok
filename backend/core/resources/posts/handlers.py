from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
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
    PostStatsResponse,
    PostDTO,
)
from core.resources.posts.exceptions import PostNotFoundError
from core.resources.posts.repositories import CommentsRepository, LikesRepository, PostsRepository
from core.resources.posts.service import PostsService
from core.services.streamlander.client import StreamlanderClient


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
        return {"items": items, "take": take, "skip": skip, "total": None}
    except PyMongoError as e:
        logger.exception("list_posts db error")
        raise HTTPException(status_code=503, detail="db unavailable") from e


@router.post("/posts/upload")
async def upload_and_create_post(
    file: UploadFile = File(...),
    caption: str = Form(default="", max_length=300),
    description: str = Form(default="", max_length=1000),
    tags: str = Form(default=""),
    username: str | None = Form(default=None),
    profilePhoto: str | None = Form(default=None),
    user=Depends(get_current_user),
):
    """
    Upload a file to streamlander, create a post in the database, and queue verification.
    This endpoint prevents direct access to streamlander and allows for rate limiting.
    """
    logger.info("upload_and_create_post user_id=%s filename=%s", user.user_id, file.filename)
    
    # Validate file type
    content_type = file.content_type or ""
    is_video = content_type == "video/mp4" or (file.filename and file.filename.lower().endswith(".mp4"))
    is_image = content_type.startswith("image/")
    
    if not is_video and not is_image:
        raise HTTPException(status_code=400, detail="Only MP4 videos and images are allowed")
    
    media_type = "video" if is_video else "image"
    
    # Read file content
    try:
        file_content = await file.read()
    except Exception as e:
        logger.exception("failed to read uploaded file")
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")
    
    # Upload to streamlander
    # Ensure filename has proper extension for streamlander validation
    upload_filename = file.filename or "upload"
    if not upload_filename:
        upload_filename = f"upload.{'mp4' if is_video else 'jpg'}"
    elif not any(upload_filename.lower().endswith(ext) for ext in ['.mp4', '.jpg', '.jpeg', '.png']):
        # Add extension if missing
        ext = '.mp4' if is_video else '.jpg'
        upload_filename = f"{upload_filename}{ext}"
    
    logger.info("uploading to streamlander filename=%s content_type=%s size=%d", upload_filename, content_type, len(file_content))
    
    streamlander_client = StreamlanderClient()
    try:
        upload_result = await streamlander_client.upload(
            filename=upload_filename,
            content_type=content_type,
            data=file_content,
        )
        media_id = upload_result.get("id")
        if not media_id:
            logger.error("streamlander did not return a media ID in response: %s", upload_result)
            raise HTTPException(status_code=500, detail="Streamlander did not return a media ID")
        logger.info("streamlander upload success media_id=%s", media_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("failed to upload to streamlander filename=%s", upload_filename)
        raise HTTPException(status_code=500, detail=f"Failed to upload to streamlander: {str(e)}")
    
    # Parse tags
    tag_list = [t.strip() for t in tags.split(",") if t.strip()][:20]
    
    # Create post in database and queue verification
    post = await _svc.create_post(
        user_id=user.user_id,
        media_id=media_id,
        media_type=media_type,
        caption=caption,
        description=description,
        tags=tag_list,
        username=username,
        profile_photo=profilePhoto,
    )
    
    logger.info("upload_and_create_post success post_id=%s media_id=%s", post.id, media_id)
    return post


@router.post("/posts")
async def create_post(req: CreatePostRequest, user=Depends(get_current_user)):
    logger.info("create_post user_id=%s media_id=%s media_type=%s", user.user_id, req.mediaId, req.mediaType)
    post = await _svc.create_post(
        user_id=user.user_id,
        media_id=req.mediaId,
        media_type=req.mediaType,
        caption=req.caption,
        description=req.description,
        tags=req.tags,
        username=req.username,
        profile_photo=req.profilePhoto,
    )
    return post


@router.get("/posts/user/{user_id}", response_model=ListPostsResponse)
async def list_user_posts(
    user_id: str,
    take: int = Query(default=50, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
):
    try:
        logger.info("list_user_posts user_id=%s take=%s skip=%s", user_id, take, skip)
        items = await _svc.list_posts_by_user(user_id=user_id, take=take, skip=skip)
        total = await _svc.count_posts_by_user(user_id=user_id)
        return {"items": items, "take": take, "skip": skip, "total": total}
    except PyMongoError as e:
        logger.exception("list_user_posts db error")
        raise HTTPException(status_code=503, detail="db unavailable") from e


@router.get("/posts/{post_id}/stats", response_model=PostStatsResponse)
async def get_post_stats(post_id: str):
    try:
        logger.info("get_post_stats post_id=%s", post_id)
        stats = await _svc.get_post_stats(post_id=post_id)
        return {"stats": stats}
    except PostNotFoundError as e:
        logger.info("get_post_stats not found post_id=%s", post_id)
        raise HTTPException(status_code=404, detail="post not found") from e


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


@router.get("/posts/{post_id}", response_model=PostDTO)
async def get_post(post_id: str):
    try:
        logger.info("get_post post_id=%s", post_id)
        post = await _svc.get_post(post_id=post_id)
        return post
    except PostNotFoundError as e:
        logger.info("get_post not found post_id=%s", post_id)
        raise HTTPException(status_code=404, detail="post not found") from e

