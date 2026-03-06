from __future__ import annotations

from datetime import datetime
from typing import Literal, NotRequired, TypedDict


UploaderStatus = Literal["active", "inactive"]
ApiKeyStatus = Literal["active", "revoked"]


class UploaderDoc(TypedDict):
    id: str
    email: str
    status: UploaderStatus
    name: NotRequired[str | None]
    createdAt: datetime


class ApiKeyDoc(TypedDict):
    id: str
    uploader_id: str
    key_hash: str
    status: ApiKeyStatus
    name: NotRequired[str | None]
    createdAt: datetime
    revokedAt: NotRequired[datetime | None]
