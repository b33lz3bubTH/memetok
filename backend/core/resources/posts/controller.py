from __future__ import annotations

from pathlib import Path
from typing import List
from uuid import uuid4
import tempfile

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form

from core.logger.logger import get_logger
from fastapi import Header
from core.plugins.auth.clerk_jwt import verify_clerk_bearer_token, AuthError
from config.config import settings
from core.resources.jobs.shared import get_shared_jobs_service
from core.resources.posts.pipeline import PipelineContext
from core.resources.posts.pipeline_shared import get_shared_pipeline
from core.resources.posts.repositories import CommentsRepository, LikesRepository, PostsRepository, SavedPostsRepository
from core.resources.posts.service import PostsService


router = APIRouter(tags=["posts"])
logger = get_logger(__name__)


def _get_posts_service() -> PostsService:
    jobs_service = get_shared_jobs_service()
    return PostsService(
        posts_repo=PostsRepository(),
        likes_repo=LikesRepository(),
        comments_repo=CommentsRepository(),
        saved_posts_repo=SavedPostsRepository(),
        jobs_service=jobs_service,
    )


_svc = _get_posts_service()


@router.post("/posts/upload")
async def upload_and_create_post(
    files: List[UploadFile] = File(...),
    caption: str = Form(default="", max_length=300),
    description: str = Form(default="", max_length=1000),
    tags: str = Form(default=""),
    username: str | None = Form(default=None),
    profilePhoto: str | None = Form(default=None),
    x_api_key: str = Header(default=None, alias="X-API-KEY"),
    user_id: str = Form(default=None),
    authorization: str = Header(default=None),
):
    """
    Only the uploader with the correct API key can upload. User ID must be provided in form data.
    """
    if not x_api_key or x_api_key != settings.uploader_api_key:
        logger.info("upload denied: invalid or missing API key")
        raise HTTPException(status_code=403, detail="Invalid or missing API key")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        token = authorization.split(" ", 1)[1].strip()
        token_user_id = await verify_clerk_bearer_token(token)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail="Invalid bearer token") from exc

    # Only allow one uploader (enforced by API key)
    if not user_id:
        logger.info("upload denied: missing user_id")
        raise HTTPException(status_code=400, detail="user_id is required")
    if token_user_id != "dev-user" and token_user_id != user_id:
        raise HTTPException(status_code=403, detail="user_id does not match authenticated user")
    """
    Save files to tmp, create post with pending status, and enqueue async upload pipeline.
    Returns immediately with pending status.
    """
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="At least one file is required")
    
    logger.info("upload_and_create_post user_id=%s file_count=%s", user_id, len(files))
    
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
        user_id=user_id,
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
        user_id=user_id,
        files=file_infos,
        tmp_dir=str(tmp_dir),
    )
    
    pipeline = get_shared_pipeline()
    await pipeline.enqueue(context)
    
    logger.info("upload_and_create_post enqueued post_id=%s", post.id)
    return post
