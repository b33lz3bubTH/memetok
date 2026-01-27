from __future__ import annotations

from core.resources.posts.pipeline import UploadPipeline
from core.resources.posts.repositories import PostsRepository
from core.resources.posts.upload_errors_repository import UploadErrorsRepository
from core.services.streamlander.client import StreamlanderClient

_pipeline: UploadPipeline | None = None


def get_shared_pipeline() -> UploadPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = UploadPipeline(
            posts_repo=PostsRepository(),
            errors_repo=UploadErrorsRepository(),
            streamlander=StreamlanderClient(),
        )
        _pipeline.start_workers(num_workers=2)
    return _pipeline
