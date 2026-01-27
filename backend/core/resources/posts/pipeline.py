from __future__ import annotations

import asyncio
import hashlib
import os
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from core.logger.logger import get_logger
from core.resources.posts.upload_errors_repository import UploadErrorsRepository
from core.resources.posts.repositories import PostsRepository
from core.services.streamlander.client import StreamlanderClient
from database.mongo_common import now_utc

logger = get_logger(__name__)


@dataclass
class PipelineContext:
    post_id: str
    user_id: str
    files: List[Dict[str, Any]]
    tmp_dir: str
    media_items: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class UploadPipeline:
    posts_repo: PostsRepository
    errors_repo: UploadErrorsRepository
    streamlander: StreamlanderClient
    _queue: asyncio.Queue[PipelineContext] = field(default_factory=asyncio.Queue)
    _workers: List[asyncio.Task] = field(default_factory=list)
    _running: bool = False
    _semaphore: asyncio.Semaphore = field(default_factory=lambda: asyncio.Semaphore(3))
    _tmp_base: Path = field(default_factory=lambda: Path(tempfile.gettempdir()) / "memetok_uploads")

    def __post_init__(self):
        self._tmp_base.mkdir(parents=True, exist_ok=True)

    async def enqueue(self, context: PipelineContext) -> None:
        await self._queue.put(context)
        logger.info("pipeline enqueued post_id=%s file_count=%s", context.post_id, len(context.files))

    async def _process_upload(self, context: PipelineContext, file_info: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        async with self._semaphore:
            file_path = file_info["path"]
            filename = file_info["filename"]
            content_type = file_info["content_type"]
            media_type = file_info["media_type"]
            
            try:
                with open(file_path, "rb") as f:
                    file_content = f.read()
                    file_hash = hashlib.md5(file_content).hexdigest()

                logger.info("uploading to streamlander post_id=%s filename=%s size=%d", context.post_id, filename, len(file_content))

                upload_result = await self.streamlander.upload(
                    filename=filename,
                    content_type=content_type,
                    data=file_content,
                )

                media_id = upload_result.get("id")
                if not media_id:
                    raise Exception("Streamlander did not return a media ID")

                logger.info("streamlander upload success post_id=%s media_id=%s", context.post_id, media_id)
                return {"type": media_type, "id": media_id, "hash": file_hash}

            except Exception as e:
                logger.exception("upload failed post_id=%s filename=%s", context.post_id, filename)
                file_hash = None
                try:
                    if os.path.exists(file_path):
                        with open(file_path, "rb") as f:
                            file_hash = hashlib.md5(f.read()).hexdigest()
                except Exception:
                    pass
                context.errors.append({
                    "filename": filename,
                    "error": str(e),
                    "hash": file_hash,
                })
                return None

    async def _process_stage1_upload(self, context: PipelineContext) -> None:
        logger.info("stage1: starting uploads post_id=%s file_count=%s", context.post_id, len(context.files))

        upload_tasks = [
            self._process_upload(context, file_info)
            for file_info in context.files
        ]

        results = await asyncio.gather(*upload_tasks, return_exceptions=True)

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.exception("upload task exception post_id=%s file_index=%s", context.post_id, i)
                context.errors.append({
                    "filename": context.files[i].get("filename", "unknown"),
                    "error": str(result),
                })
            elif result:
                context.media_items.append(result)

        logger.info("stage1: completed post_id=%s success=%s errors=%s", context.post_id, len(context.media_items), len(context.errors))

    async def _process_stage2_update_post(self, context: PipelineContext) -> None:
        logger.info("stage2: updating post post_id=%s", context.post_id)

        if context.errors:
            await self._log_errors(context)

        if context.media_items:
            await self.posts_repo.update_media(context.post_id, context.media_items)
            await self.posts_repo.set_status(context.post_id, "posted")
            logger.info("stage2: post updated to posted post_id=%s media_count=%s", context.post_id, len(context.media_items))
        else:
            await self.posts_repo.set_status(context.post_id, "pending")
            logger.warning("stage2: no media items uploaded post_id=%s", context.post_id)

    async def _log_errors(self, context: PipelineContext) -> None:
        for error in context.errors:
            error_doc = {
                "postId": context.post_id,
                "userId": context.user_id,
                "filename": error.get("filename", "unknown"),
                "error": error.get("error", "Unknown error"),
                "hash": error.get("hash"),
                "createdAt": now_utc(),
            }
            await self.errors_repo.insert(error_doc)
            logger.info("logged upload error post_id=%s filename=%s", context.post_id, error.get("filename"))

    async def _cleanup_tmp_files(self, context: PipelineContext) -> None:
        try:
            if os.path.exists(context.tmp_dir):
                import shutil
                shutil.rmtree(context.tmp_dir)
                logger.info("cleaned up tmp files post_id=%s tmp_dir=%s", context.post_id, context.tmp_dir)
        except Exception as e:
            logger.exception("failed to cleanup tmp files post_id=%s", context.post_id)

    async def _process_pipeline(self, context: PipelineContext) -> None:
        try:
            await self._process_stage1_upload(context)
            await self._process_stage2_update_post(context)
        finally:
            await self._cleanup_tmp_files(context)

    async def _worker(self) -> None:
        logger.info("pipeline worker started")
        while self._running:
            try:
                context = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                await self._process_pipeline(context)
                self._queue.task_done()
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.exception("pipeline worker error: %s", e)
                self._queue.task_done()

    def start_workers(self, num_workers: int = 2) -> None:
        if not self._running:
            self._running = True
            for i in range(num_workers):
                task = asyncio.create_task(self._worker())
                self._workers.append(task)
            logger.info("pipeline workers started count=%s", num_workers)

    async def stop_workers(self) -> None:
        self._running = False
        for task in self._workers:
            if not task.done():
                task.cancel()
        await asyncio.gather(*self._workers, return_exceptions=True)
        logger.info("pipeline workers stopped")
