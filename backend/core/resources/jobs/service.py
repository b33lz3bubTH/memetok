from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, Dict

from common.app_constants import JOB_TYPE_VERIFY_MEDIA, POST_STATUS_POSTED
from database.mongo_common import now_utc
from core.logger.logger import get_logger
from core.resources.jobs.repositories import JobsRepository
from core.resources.posts.repositories import PostsRepository
from core.services.streamlander.client import StreamlanderClient


logger = get_logger(__name__)


@dataclass
class JobsService:
    jobs_repo: JobsRepository
    posts_repo: PostsRepository
    streamlander: StreamlanderClient
    _queue: asyncio.Queue[Dict[str, Any]] = field(default_factory=asyncio.Queue)
    _worker_task: asyncio.Task[None] | None = None
    _running: bool = False

    async def enqueue_verify_media(self, post_id: str, media_id: str, media_type: str) -> None:
        now = now_utc()
        logger.info("job enqueue verify_media post_id=%s media_id=%s media_type=%s", post_id, media_id, media_type)
        job_doc = {
            "type": JOB_TYPE_VERIFY_MEDIA,
            "postId": post_id,
            "mediaId": media_id,
            "mediaType": media_type,
            "attempts": 0,
            "nextRunAt": now,
            "createdAt": now,
            "updatedAt": now,
        }
        job_id = await self.jobs_repo.enqueue(job_doc)
        job_doc["_id"] = job_id
        await self._queue.put(job_doc)

    async def _process_verify_media_job(self, job: Dict[str, Any]) -> tuple[bool, bool]:
        media_id = str(job.get("mediaId", ""))
        post_id = str(job.get("postId", ""))
        media_type = str(job.get("mediaType", "") or "")
        attempts = int(job.get("attempts", 0))

        post = await self.posts_repo.find_by_id(post_id)
        if not post:
            logger.info("job drop verify_media (post missing) post_id=%s media_id=%s", post_id, media_id)
            return True, False

        exists = await self.streamlander.media_exists(media_id)
        if exists:
            logger.info("media exists -> post posted post_id=%s media_id=%s", post_id, media_id)
            await self.posts_repo.set_status(post_id, POST_STATUS_POSTED)
            return True, True

        now = now_utc()
        attempts += 1
        delay_s = min(30 * (2 ** (attempts - 1)), 60 * 30)
        next_run = now + timedelta(seconds=delay_s)
        logger.info(
            "media not exists -> defer post_id=%s media_id=%s attempts=%s next_run_in_s=%s",
            post_id,
            media_id,
            attempts,
            delay_s,
        )
        job["attempts"] = attempts
        job["nextRunAt"] = next_run
        job["updatedAt"] = now
        await self.jobs_repo.update(
            job.get("_id"),
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
                if job.get("type") != JOB_TYPE_VERIFY_MEDIA:
                    self._queue.task_done()
                    continue

                job_id = job.get("_id")
                if not job_id:
                    db_job = await self.jobs_repo.find_by_post_id(job.get("postId", ""))
                    if db_job:
                        job["_id"] = db_job["_id"]
                        job_id = db_job["_id"]
                    else:
                        logger.warning("job not found in db post_id=%s", job.get("postId"))
                        self._queue.task_done()
                        continue

                completed, posted = await self._process_verify_media_job(job)
                if completed:
                    if job_id:
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
        jobs = await self.jobs_repo.fetch_due(now=now, limit=limit)
        processed = 0
        posted = 0
        deferred = 0

        for job in jobs:
            processed += 1
            if job.get("type") != JOB_TYPE_VERIFY_MEDIA:
                await self.jobs_repo.delete(job["_id"])
                continue

            completed, was_posted = await self._process_verify_media_job(job)
            if completed:
                if was_posted:
                    posted += 1
            else:
                deferred += 1

        return {"processed": processed, "posted": posted, "deferred": deferred}

