from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import timedelta

from common.app_constants import JOB_TYPE_VERIFY_MEDIA, POST_STATUS_POSTED
from core.logger.logger import get_logger
from core.resources.jobs.dtos import ProcessDueJobsResponseDTO, VerifyMediaJobDTO
from core.resources.jobs.repositories import JobsRepository
from core.resources.posts.repositories import PostsRepository
from core.services.streamlander.client import StreamlanderClient
from database.mongo_common import now_utc

logger = get_logger(__name__)


@dataclass
class JobsService:
    jobs_repo: JobsRepository
    posts_repo: PostsRepository
    streamlander: StreamlanderClient
    _queue: asyncio.Queue[VerifyMediaJobDTO] = field(default_factory=asyncio.Queue)
    _worker_task: asyncio.Task[None] | None = None
    _running: bool = False

    async def enqueue_verify_media(self, post_id: str, media_id: str, media_type: str) -> None:
        now = now_utc()
        logger.info("job enqueue verify_media post_id=%s media_id=%s media_type=%s", post_id, media_id, media_type)
        job = VerifyMediaJobDTO(
            type=JOB_TYPE_VERIFY_MEDIA,
            postId=post_id,
            mediaId=media_id,
            mediaType=media_type,
            attempts=0,
            nextRunAt=now,
            createdAt=now,
            updatedAt=now,
        )
        job_id = await self.jobs_repo.enqueue(job.model_dump(exclude={"id"}, by_alias=True))
        queue_job = job.model_copy(update={"id": job_id})
        await self._queue.put(queue_job)

    async def _process_verify_media_job(self, job: VerifyMediaJobDTO) -> tuple[bool, bool]:
        post = await self.posts_repo.find_by_id(job.postId)
        if not post:
            logger.info("job drop verify_media (post missing) post_id=%s media_id=%s", job.postId, job.mediaId)
            return True, False

        exists = await self.streamlander.media_exists(job.mediaId)
        if exists:
            logger.info("media exists -> post posted post_id=%s media_id=%s", job.postId, job.mediaId)
            await self.posts_repo.set_status(job.postId, POST_STATUS_POSTED)
            return True, True

        now = now_utc()
        attempts = job.attempts + 1
        delay_s = min(30 * (2 ** (attempts - 1)), 60 * 30)
        next_run = now + timedelta(seconds=delay_s)
        logger.info(
            "media not exists -> defer post_id=%s media_id=%s attempts=%s next_run_in_s=%s",
            job.postId,
            job.mediaId,
            attempts,
            delay_s,
        )

        if job.id:
            await self.jobs_repo.update(
                job.id,
                {
                    "$set": {"attempts": attempts, "nextRunAt": next_run, "updatedAt": now},
                },
            )
        return False, False

    async def _worker(self) -> None:
        logger.info("queue worker started")
        while self._running:
            try:
                job = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                if job.type != JOB_TYPE_VERIFY_MEDIA:
                    self._queue.task_done()
                    continue

                job_id = job.id
                if not job_id:
                    db_job = await self.jobs_repo.find_by_post_id(job.postId)
                    if db_job:
                        job = VerifyMediaJobDTO.model_validate(db_job)
                        job_id = job.id
                    else:
                        logger.warning("job not found in db post_id=%s", job.postId)
                        self._queue.task_done()
                        continue

                completed, posted = await self._process_verify_media_job(job)
                if completed and job_id:
                    await self.jobs_repo.delete(job_id)
                self._queue.task_done()
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.exception("queue worker error: %s", e)
                self._queue.task_done()

    def start_worker(self) -> None:
        if self._worker_task is None or self._worker_task.done():
            self._running = True
            self._worker_task = asyncio.create_task(self._worker())
            logger.info("queue worker task started")

    async def stop_worker(self) -> None:
        self._running = False
        if self._worker_task and not self._worker_task.done():
            await asyncio.sleep(0.1)
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("queue worker stopped")

    async def process_due(self, limit: int) -> dict:
        now = now_utc()
        job_docs = await self.jobs_repo.fetch_due(now=now, limit=limit)
        jobs = [VerifyMediaJobDTO.model_validate(job_doc) for job_doc in job_docs]
        processed = 0
        posted = 0
        deferred = 0

        for job in jobs:
            processed += 1
            if job.type != JOB_TYPE_VERIFY_MEDIA:
                if job.id:
                    await self.jobs_repo.delete(job.id)
                continue

            completed, was_posted = await self._process_verify_media_job(job)
            if completed:
                if was_posted:
                    posted += 1
                if job.id:
                    await self.jobs_repo.delete(job.id)
            else:
                deferred += 1

        result = ProcessDueJobsResponseDTO(processed=processed, posted=posted, deferred=deferred)
        return result.model_dump()
