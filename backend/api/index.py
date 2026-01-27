from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.config import settings
from core.logger.logger import get_logger
from core.services.dispatch.handlers import router as dispatch_router
from core.resources.posts.handlers import router as posts_router
from core.resources.media.handlers import router as media_router
from core.resources.jobs.handlers import router as jobs_router


logger = get_logger(__name__)

def create_app() -> FastAPI:
    app = FastAPI(title="memetok-backend", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(dispatch_router, prefix="/api")
    app.include_router(posts_router, prefix="/api")
    app.include_router(media_router, prefix="/api")
    app.include_router(jobs_router, prefix="/api")

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    logger.info("app created")
    return app


app = create_app()

