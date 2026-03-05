from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path
import shutil
import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
from core.resources.posts.upload_errors_repository import UploadErrorsRepository
from core.resources.uploaders.service import UploaderService
from core.resources.uploaders.handlers import register_uploaders_handlers
from core.plugins.security import SecurityHeadersMiddleware, RateLimitMiddleware, RequestTimeoutMiddleware
from database.mongo_factory import check_health as db_check_health


logger = get_logger(__name__)

_is_production = settings.environment == "production"


def _print_startup_banner() -> None:
    """Print a sanitized config summary at startup."""
    logger.info("=" * 60)
    logger.info("MEMETOK BACKEND — starting up")
    logger.info("=" * 60)
    logger.info("  environment       : %s", settings.environment)
    logger.info("  mongo_db          : %s", settings.mongo_db)
    logger.info("  mongo_pool        : min=%d max=%d", settings.mongo_min_pool_size, settings.mongo_max_pool_size)
    logger.info("  cors_origins      : %s", settings.cors_allow_origins)
    logger.info("  rate_limit_rpm    : %d", settings.rate_limit_rpm)
    logger.info("  request_timeout   : %ds", settings.request_timeout_seconds)
    logger.info("  pipeline_workers  : %d", settings.pipeline_workers)
    logger.info("  upload_max_files  : %d", settings.upload_max_files)
    logger.info("  upload_max_size   : %dMB", settings.upload_max_file_size_mb)
    logger.info("  auth_disabled     : %s", settings.auth_disabled)
    logger.info("  log_format        : %s", settings.log_format)
    logger.info("=" * 60)


def _validate_secrets() -> None:
    """Block startup in production if secrets are defaults."""
    problems = settings.validate_production_secrets()
    if problems and _is_production:
        for p in problems:
            logger.error("CONFIG ERROR: %s", p)
        logger.error("Refusing to start in production with insecure defaults. Fix your .env file.")
        sys.exit(1)
    elif problems:
        for p in problems:
            logger.warning("CONFIG WARNING: %s", p)


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
    _print_startup_banner()
    _validate_secrets()

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

    # Ensure ALL repository indexes at startup (not just posts)
    posts_repo = PostsRepository()
    likes_repo = LikesRepository()
    comments_repo = CommentsRepository()
    saved_posts_repo = SavedPostsRepository()
    await posts_repo.ensure_indexes()
    await likes_repo.ensure_indexes()
    await saved_posts_repo.ensure_indexes()
    logger.info("all repository indexes ensured")

    event_bus = get_event_bus()
    event_bus.start()
    logger.info("event bus started")
    
    posts_service = PostsService(
        posts_repo=posts_repo,
        likes_repo=likes_repo,
        comments_repo=comments_repo,
        saved_posts_repo=saved_posts_repo,
        jobs_service=jobs_service,
    )
    register_posts_handlers(posts_service, UploadErrorsRepository())
    logger.info("posts handlers registered")

    # cleanup any dangling posts from previous crashes
    await posts_service.cleanup_dangling_posts(older_than_minutes=60)

    uploader_service = UploaderService()
    register_uploaders_handlers(uploader_service)
    logger.info("uploader handlers registered")

    logger.info("startup complete — ready to serve")
    
    yield
    
    await event_bus.stop()
    logger.info("event bus stopped")
    
    await jobs_service.stop_worker()
    logger.info("background queue worker stopped")
    
    await pipeline.stop_workers()
    logger.info("upload pipeline workers stopped")

    logger.info("shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(title="memetok-backend", version="0.1.0", lifespan=lifespan)

    # --- Security Middleware (outermost = applied first) ---
    # Order matters: timeout → rate limit → security headers → CORS → request log
    app.add_middleware(RequestTimeoutMiddleware, timeout_seconds=settings.request_timeout_seconds)
    app.add_middleware(
        RateLimitMiddleware,
        max_requests=settings.rate_limit_rpm,
        window_seconds=60,
        exempt_paths=["/health"],
    )
    app.add_middleware(SecurityHeadersMiddleware)

    # CORS
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

    # --- Global exception handler (strips stack traces in production) ---
    @app.exception_handler(Exception)
    async def _global_exception_handler(request: Request, exc: Exception):
        logger.exception("unhandled exception path=%s", request.url.path)
        detail = "internal server error"
        if not _is_production:
            detail = f"{type(exc).__name__}: {exc}"
        return JSONResponse(status_code=500, content={"detail": detail})

    # --- Request logging middleware ---
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

    # --- Health check with DB connectivity ---
    @app.get("/health")
    async def health():
        db_ok = await db_check_health()
        status = "ok" if db_ok else "degraded"
        code = 200 if db_ok else 503
        return JSONResponse(
            status_code=code,
            content={"status": status, "db": "connected" if db_ok else "unreachable"},
        )

    logger.info("app created")
    return app


app = create_app()

