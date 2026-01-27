from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query

from config.config import settings
from core.logger.logger import get_logger
from core.resources.jobs.service import JobsService
from core.resources.jobs.shared import get_shared_jobs_service


router = APIRouter(tags=["jobs"])
logger = get_logger(__name__)


def _get_jobs_service() -> JobsService:
    return get_shared_jobs_service()


@router.post("/internal/jobs/process")
async def process_jobs(
    limit: int = Query(default=20, ge=1, le=200),
    x_internal_jobs_secret: str | None = Header(default=None),
):
    if x_internal_jobs_secret != settings.internal_jobs_secret:
        logger.info("process_jobs forbidden")
        raise HTTPException(status_code=403, detail="forbidden")

    svc = _get_jobs_service()
    logger.info("process_jobs start limit=%s", limit)
    return await svc.process_due(limit=limit)

