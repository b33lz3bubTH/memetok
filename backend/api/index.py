from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uuid import uuid4
import time

from config.config import settings
from core.logger.logger import get_logger
from core.services.dispatch.handlers import router as dispatch_router
from core.resources.posts.handlers import router as posts_router
from core.resources.jobs.handlers import router as jobs_router
from core.resources.jobs.shared import get_shared_jobs_service


logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    jobs_service = get_shared_jobs_service()
    jobs_service.start_worker()
    logger.info("background queue worker started")
    yield
    await jobs_service.stop_worker()
    logger.info("background queue worker stopped")


def create_app() -> FastAPI:
    app = FastAPI(title="memetok-backend", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(dispatch_router, prefix="/api")
    app.include_router(posts_router, prefix="/api")
    app.include_router(jobs_router, prefix="/api")

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

