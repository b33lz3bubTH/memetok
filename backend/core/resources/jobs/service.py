from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from common.app_constants import JOB_TYPE_VERIFY_MEDIA, POST_STATUS_POSTED
from database.mongo_common import now_utc
from core.resources.jobs.repositories import JobsRepository
from core.resources.posts.repositories import PostsRepository
from core.services.streamlander.client import StreamlanderClient


@dataclass
class JobsService:
    jobs_repo: JobsRepository
    posts_repo: PostsRepository
    streamlander: StreamlanderClient

    async def enqueue_verify_media(self, post_id: str, media_id: str) -> None:
        now = now_utc()
        await self.jobs_repo.enqueue(
            {
                "type": JOB_TYPE_VERIFY_MEDIA,
                "postId": post_id,
                "mediaId": media_id,
                "attempts": 0,
                "nextRunAt": now,
                "createdAt": now,
                "updatedAt": now,
            }
        )

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

            media_id = str(job.get("mediaId", ""))
            post_id = str(job.get("postId", ""))
            attempts = int(job.get("attempts", 0))

            exists = await self.streamlander.media_exists(media_id)
            if exists:
                await self.posts_repo.set_status(post_id, POST_STATUS_POSTED)
                await self.jobs_repo.delete(job["_id"])
                posted += 1
                continue

            # exponential backoff, cap
            attempts += 1
            delay_s = min(30 * (2 ** (attempts - 1)), 60 * 30)
            next_run = now + timedelta(seconds=delay_s)
            await self.jobs_repo.update(
                job["_id"],
                {
                    "$set": {"attempts": attempts, "nextRunAt": next_run, "updatedAt": now},
                },
            )
            deferred += 1

        return {"processed": processed, "posted": posted, "deferred": deferred}

