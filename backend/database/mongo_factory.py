from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config.config import settings


@dataclass(frozen=True)
class MongoContext:
    client: AsyncIOMotorClient
    db: AsyncIOMotorDatabase


_mongo_ctx: Optional[MongoContext] = None


def get_mongo() -> MongoContext:
    global _mongo_ctx
    if _mongo_ctx is not None:
        return _mongo_ctx

    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.mongo_db]
    _mongo_ctx = MongoContext(client=client, db=db)
    return _mongo_ctx

