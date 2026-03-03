from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


@dataclass
class ApiKey:
    id: str
    uploader_id: str
    key_hash: str
    status: str = "active"  # active, revoked
    name: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    revoked_at: Optional[datetime] = None

    def to_dict(self):
        return {
            "id": self.id,
            "uploader_id": self.uploader_id,
            "key_hash": self.key_hash,
            "status": self.status,
            "name": self.name,
            "createdAt": self.created_at,
            "revokedAt": self.revoked_at
        }

    @classmethod
    def from_dict(cls, data: dict):
        return cls(
            id=data.get("id"),
            uploader_id=data.get("uploader_id"),
            key_hash=data.get("key_hash"),
            status=data.get("status", "active"),
            name=data.get("name"),
            created_at=data.get("createdAt"),
            revoked_at=data.get("revokedAt")
        )


@dataclass
class Uploader:
    id: str
    email: str
    status: str = "active"  # active, inactive
    name: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "status": self.status,
            "name": self.name,
            "createdAt": self.created_at
        }

    @classmethod
    def from_dict(cls, data: dict):
        return cls(
            id=data.get("id"),
            email=data.get("email"),
            status=data.get("status", "active"),
            name=data.get("name"),
            created_at=data.get("createdAt")
        )
