from __future__ import annotations

from core.resources.jobs.repositories import JobsRepository
from core.resources.jobs.service import JobsService
from core.resources.posts.repositories import PostsRepository
from core.services.streamlander.client import StreamlanderClient


_jobs_service: JobsService | None = None


def get_shared_jobs_service() -> JobsService:
    global _jobs_service
    if _jobs_service is None:
        _jobs_service = JobsService(
            jobs_repo=JobsRepository(),
            posts_repo=PostsRepository(),
            streamlander=StreamlanderClient(),
        )
    return _jobs_service
