from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query

from config.config import settings
from core.resources.jobs.repositories import JobsRepository
from core.resources.jobs.service import JobsService
from core.resources.posts.repositories import PostsRepository
from core.services.streamlander.client import StreamlanderClient


router = APIRouter(tags=["jobs"])


def _get_jobs_service() -> JobsService:
    return JobsService(
        jobs_repo=JobsRepository(),
        posts_repo=PostsRepository(),
        streamlander=StreamlanderClient(),
    )


@router.post("/internal/jobs/process")
async def process_jobs(
    limit: int = Query(default=20, ge=1, le=200),
    x_internal_jobs_secret: str | None = Header(default=None),
):
    if x_internal_jobs_secret != settings.internal_jobs_secret:
        raise HTTPException(status_code=403, detail="forbidden")

    svc = _get_jobs_service()
    return await svc.process_due(limit=limit)

