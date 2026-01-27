from __future__ import annotations

import hashlib
import os
import tempfile
from pathlib import Path
from typing import List
from uuid import uuid4

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
    MediaItem,
)
from core.resources.posts.exceptions import PostNotFoundError
from core.resources.posts.pipeline import PipelineContext
from core.resources.posts.pipeline_shared import get_shared_pipeline
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
        return {"items": items, "take": take, "skip": skip, "total": None}
    except PyMongoError as e:
        logger.exception("list_posts db error")
        raise HTTPException(status_code=503, detail="db unavailable") from e


@router.post("/posts/upload")
async def upload_and_create_post(
    files: List[UploadFile] = File(...),
    caption: str = Form(default="", max_length=300),
    description: str = Form(default="", max_length=1000),
    tags: str = Form(default=""),
    username: str | None = Form(default=None),
    profilePhoto: str | None = Form(default=None),
    user=Depends(get_current_user),
):
    """
    Save files to tmp, create post with pending status, and enqueue async upload pipeline.
    Returns immediately with pending status.
    """
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="At least one file is required")
    
    logger.info("upload_and_create_post user_id=%s file_count=%s", user.user_id, len(files))
    
    # Validate files
    videos = []
    images = []
    for file in files:
        content_type = file.content_type or ""
        is_video = content_type == "video/mp4" or (file.filename and file.filename.lower().endswith(".mp4"))
        is_image = content_type.startswith("image/")
        
        if not is_video and not is_image:
            raise HTTPException(status_code=400, detail=f"File {file.filename} is not a valid MP4 video or image")
        
        if is_video:
            videos.append(file)
        else:
            images.append(file)
    
    # Validate: videos can only be solo, images can be multiple
    if len(videos) > 1:
        raise HTTPException(status_code=400, detail="Only one video is allowed per post")
    if len(videos) > 0 and len(images) > 0:
        raise HTTPException(status_code=400, detail="Cannot mix videos and images in one post")
    
    # Parse tags
    tag_list = [t.strip() for t in tags.split(",") if t.strip()][:20]
    
    # Create post with pending status (no media yet)
    post = await _svc.create_post(
        user_id=user.user_id,
        caption=caption,
        description=description,
        tags=tag_list,
        username=username,
        profile_photo=profilePhoto,
    )
    
    # Save files to tmp directory
    tmp_base = Path(tempfile.gettempdir()) / "memetok_uploads"
    tmp_base.mkdir(parents=True, exist_ok=True)
    tmp_dir = tmp_base / str(uuid4())
    tmp_dir.mkdir(parents=True, exist_ok=True)
    
    file_infos = []
    for file in files:
        content_type = file.content_type or ""
        is_video = content_type == "video/mp4" or (file.filename and file.filename.lower().endswith(".mp4"))
        media_type = "video" if is_video else "image"
        
        filename = file.filename or f"upload.{'mp4' if is_video else 'jpg'}"
        if not any(filename.lower().endswith(ext) for ext in ['.mp4', '.jpg', '.jpeg', '.png']):
            ext = '.mp4' if is_video else '.jpg'
            filename = f"{filename}{ext}"
        
        file_path = tmp_dir / filename
        
        try:
            file_content = await file.read()
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            file_infos.append({
                "path": str(file_path),
                "filename": filename,
                "content_type": content_type,
                "media_type": media_type,
            })
            logger.info("saved file to tmp post_id=%s filename=%s size=%d", post.id, filename, len(file_content))
        except Exception as e:
            logger.exception("failed to save file to tmp post_id=%s filename=%s", post.id, filename)
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Create pipeline context and enqueue
    context = PipelineContext(
        post_id=post.id,
        user_id=user.user_id,
        files=file_infos,
        tmp_dir=str(tmp_dir),
    )
    
    pipeline = get_shared_pipeline()
    await pipeline.enqueue(context)
    
    logger.info("upload_and_create_post enqueued post_id=%s", post.id)
    return post


@router.post("/posts")
async def create_post(req: CreatePostRequest, user=Depends(get_current_user)):
    logger.info("create_post user_id=%s", user.user_id)
    post = await _svc.create_post(
        user_id=user.user_id,
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

