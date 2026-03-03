from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path
import shutil

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uuid import uuid4
import time

from config.config import settings
from core.logger.logger import get_logger
from core.resources.jobs.shared import get_shared_jobs_service
from core.resources.posts.pipeline_shared import get_shared_pipeline
from core.services.cqrs.generic_route import router as generic_router
from core.resources.posts.controller import router as posts_upload_router
from core.resources.posts.access_control import get_access_control_service
from core.services.cqrs.event_bus import get_event_bus
from core.resources.posts.handlers import register_posts_handlers
from core.resources.posts.service import PostsService
from core.resources.posts.repositories import CommentsRepository, LikesRepository, PostsRepository, SavedPostsRepository
from core.resources.uploaders.service import UploaderService
from core.resources.uploaders.handlers import register_uploaders_handlers


logger = get_logger(__name__)


def cleanup_stale_upload_dirs(max_age_hours: int = 1) -> int:
    tmp_base = Path("/tmp/memetok_uploads")
    if not tmp_base.exists():
        return 0
    cutoff = time.time() - timedelta(hours=max_age_hours).total_seconds()
    removed = 0
    for path in tmp_base.iterdir():
        if not path.is_dir():
            continue
        try:
            if path.stat().st_mtime < cutoff:
                shutil.rmtree(path, ignore_errors=True)
                removed += 1
        except OSError:
            logger.exception("failed to cleanup stale upload dir path=%s", path)
    return removed


@asynccontextmanager
async def lifespan(app: FastAPI):
    jobs_service = get_shared_jobs_service()
    jobs_service.start_worker()
    logger.info("background queue worker started")
    
    pipeline = get_shared_pipeline()
    removed_tmp_dirs = cleanup_stale_upload_dirs(max_age_hours=1)
    if removed_tmp_dirs:
        logger.info("cleaned stale upload tmp dirs count=%s", removed_tmp_dirs)
    pipeline.start_workers(num_workers=settings.pipeline_workers)
    logger.info("upload pipeline workers started count=%s", settings.pipeline_workers)
    
    access_service = get_access_control_service()
    await access_service.setup()
    logger.info("access control indexes ensured")

    event_bus = get_event_bus()
    event_bus.start()
    logger.info("event bus started")
    
    posts_service = PostsService(
        posts_repo=PostsRepository(),
        likes_repo=LikesRepository(),
        comments_repo=CommentsRepository(),
        saved_posts_repo=SavedPostsRepository(),
        jobs_service=jobs_service,
    )
    register_posts_handlers(posts_service)
    logger.info("posts handlers registered")

    uploader_service = UploaderService()
    register_uploaders_handlers(uploader_service)
    logger.info("uploader handlers registered")
    
    yield
    
    await event_bus.stop()
    logger.info("event bus stopped")
    
    await jobs_service.stop_worker()
    logger.info("background queue worker stopped")
    
    await pipeline.stop_workers()
    logger.info("upload pipeline workers stopped")


def create_app() -> FastAPI:
    app = FastAPI(title="memetok-backend", version="0.1.0", lifespan=lifespan)

    # When allow_origins is ["*"], allow_credentials must be False
    # Otherwise, we can use allow_credentials=True with specific origins
    cors_origins = settings.cors_allow_origins
    use_credentials = cors_origins != ["*"] and len(cors_origins) > 0

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=use_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    app.include_router(generic_router)
    app.include_router(posts_upload_router, prefix="/api")

    @app.middleware("http")
    async def _log_requests(request, call_next):  # type: ignore[no-untyped-def]
        req_id = uuid4().hex[:12]
        start = time.perf_counter()
        logger.info("req start id=%s method=%s path=%s", req_id, request.method, request.url.path)
        try:
            response = await call_next(request)
        except Exception:
            dur_ms = int((time.perf_counter() - start) * 1000)
            logger.exception("req error id=%s dur_ms=%s", req_id, dur_ms)
            raise
        dur_ms = int((time.perf_counter() - start) * 1000)
        logger.info("req end id=%s status=%s dur_ms=%s", req_id, response.status_code, dur_ms)
        return response

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    logger.info("app created")
    return app


app = create_app()

