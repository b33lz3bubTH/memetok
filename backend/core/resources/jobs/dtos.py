from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class VerifyMediaJobDTO(BaseModel):
    id: Optional[Any] = Field(default=None, alias="_id")
    type: str
    postId: str
    mediaId: str
    mediaType: str
    attempts: int = 0
    nextRunAt: datetime
    createdAt: datetime
    updatedAt: datetime


class ProcessDueJobsResponseDTO(BaseModel):
    processed: int
    posted: int
    deferred: int
