from __future__ import annotations

import asyncio
import hmac
import tempfile
import time
from collections import defaultdict
from pathlib import Path
from typing import List
from uuid import uuid4

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

from config.config import settings
from core.logger.logger import get_logger
from core.plugins.auth.clerk_jwt import AuthError, verify_clerk_bearer_token
from core.resources.posts.access_control import get_access_control_service
from core.resources.jobs.shared import get_shared_jobs_service
from core.resources.posts.pipeline import PipelineContext
from core.resources.posts.pipeline_shared import get_shared_pipeline
from core.resources.posts.repositories import CommentsRepository, LikesRepository, PostsRepository, SavedPostsRepository
from core.resources.posts.service import PostsService

router = APIRouter(tags=["posts"])
logger = get_logger(__name__)

_UPLOAD_CHUNK_SIZE_BYTES = 1024 * 1024  # 1MB
_MAX_FILE_BYTES = settings.upload_max_file_size_mb * 1024 * 1024
_UPLOAD_INGEST_SEMAPHORE = asyncio.Semaphore(max(1, settings.upload_ingest_concurrency))


class UploadRateLimiter:
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.uploads: defaultdict[str, list[float]] = defaultdict(list)

    def is_allowed(self, client_id: str) -> bool:
        now = time.time()
        self.uploads[client_id] = [t for t in self.uploads[client_id] if now - t < self.window_seconds]
        if len(self.uploads[client_id]) >= self.max_requests:
            return False
        self.uploads[client_id].append(now)
        return True


_upload_limiter = UploadRateLimiter(max_requests=5, window_seconds=3600)  # 5 uploads per hour


def _is_valid_magic_bytes(file_path: Path, expected_type: str) -> bool:
    try:
        with open(file_path, "rb") as f:
            magic = f.read(12)
        if not magic:
            return False
        if expected_type == "video":
            return b"ftyp" in magic
        elif expected_type == "image":
            return (
                magic.startswith(b"\xff\xd8") or
                magic.startswith(b"\x89PNG") or
                magic.startswith(b"GIF")
            )
        return False
    except IOError:
        return False


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


async def _persist_upload_file(file: UploadFile, file_path: Path) -> int:
    total_written = 0
    with open(file_path, "wb") as handle:
        while True:
            chunk = await file.read(_UPLOAD_CHUNK_SIZE_BYTES)
            if not chunk:
                break
            total_written += len(chunk)
            if total_written > _MAX_FILE_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"File {file.filename} exceeds max size of {settings.upload_max_file_size_mb}MB",
                )
            handle.write(chunk)
    return total_written


@router.post("/posts/upload")
async def upload_and_create_post(
    files: List[UploadFile] = File(...),
    caption: str = Form(default="", max_length=300),
    description: str = Form(default="", max_length=1000),
    tags: str = Form(default=""),
    username: str | None = Form(default=None),
    profilePhoto: str | None = Form(default=None),
    email: str = Form(default=""),
    x_api_key: str = Header(default=None, alias="X-API-KEY"),
    x_super_admin_key: str = Header(default=None, alias="X-Super-Admin-Key"),
    authorization: str | None = Header(default=None),
):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")

    try:
        token = authorization.split(" ", 1)[1].strip()
        claims = await verify_clerk_bearer_token(token)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    is_super_admin = False
    if x_super_admin_key:
        is_super_admin = hmac.compare_digest(x_super_admin_key, settings.super_admin_api_key)

    if not is_super_admin and not x_api_key:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")

    valid_email = email or claims.email or ""

    if not is_super_admin:
        access_service = get_access_control_service()
        allowed = await access_service.validate_uploader(
            email=valid_email,
            api_key=x_api_key,
        )
        if not allowed:
            logger.info("upload denied for user_id=%s email=%s", claims.user_id, valid_email)
            raise HTTPException(status_code=403, detail="Uploader access denied")

    if not _upload_limiter.is_allowed(claims.user_id):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")

    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")
    if len(files) > settings.upload_max_files:
        raise HTTPException(status_code=400, detail=f"Maximum {settings.upload_max_files} files allowed")

    logger.info("upload_and_create_post user_id=%s file_count=%s", claims.user_id, len(files))

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

    if len(videos) > 1:
        raise HTTPException(status_code=400, detail="Only one video is allowed per post")
    if videos and images:
        raise HTTPException(status_code=400, detail="Cannot mix videos and images in one post")

    tag_list = [t.strip() for t in tags.split(",") if t.strip()][:20]

    post = await _svc.create_post(
        user_id=claims.user_id,
        caption=caption,
        description=description,
        tags=tag_list,
        username=username or claims.email or claims.user_id,
        profile_photo=profilePhoto,
    )

    tmp_base = Path(tempfile.gettempdir()) / "memetok_uploads"
    tmp_base.mkdir(parents=True, exist_ok=True)
    tmp_dir = tmp_base / str(uuid4())
    tmp_dir.mkdir(parents=True, exist_ok=True)

    file_infos = []
    async with _UPLOAD_INGEST_SEMAPHORE:
        for file in files:
            content_type = file.content_type or ""
            is_video = content_type == "video/mp4" or (file.filename and file.filename.lower().endswith(".mp4"))
            media_type = "video" if is_video else "image"

            filename = file.filename or f"upload.{'mp4' if is_video else 'jpg'}"
            if not any(filename.lower().endswith(ext) for ext in [".mp4", ".jpg", ".jpeg", ".png"]):
                ext = ".mp4" if is_video else ".jpg"
                filename = f"{filename}{ext}"

            file_path = tmp_dir / filename

            try:
                size = await _persist_upload_file(file, file_path)
                
                # Validate actual file magic bytes to prevent spoofing
                if not _is_valid_magic_bytes(file_path, media_type):
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(status_code=400, detail=f"File {filename} content does not match extension")

                file_infos.append(
                    {
                        "path": str(file_path),
                        "filename": filename,
                        "content_type": content_type,
                        "media_type": media_type,
                    }
                )
                logger.info("saved file to tmp post_id=%s filename=%s size=%d", post.id, filename, size)
            except HTTPException:
                raise
            except Exception as exc:
                logger.exception("failed to save file to tmp post_id=%s filename=%s", post.id, filename)
                raise HTTPException(status_code=500, detail=f"Failed to save file: {str(exc)}") from exc
            finally:
                await file.close()

    context = PipelineContext(
        post_id=post.id,
        user_id=claims.user_id,
        files=file_infos,
        tmp_dir=str(tmp_dir),
    )

    pipeline = get_shared_pipeline()
    await pipeline.enqueue(context)

    logger.info("upload_and_create_post enqueued post_id=%s", post.id)
    return post
