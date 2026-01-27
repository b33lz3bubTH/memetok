from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List

from database.mongo_factory import get_mongo
from core.resources.jobs.constants import JOBS_COLLECTION


@dataclass
class JobsRepository:
    async def enqueue(self, doc: Dict[str, Any]) -> None:
        mongo = get_mongo()
        await mongo.db[JOBS_COLLECTION].insert_one(doc)

    async def fetch_due(self, now: datetime, limit: int) -> List[Dict[str, Any]]:
        mongo = get_mongo()
        cursor = (
            mongo.db[JOBS_COLLECTION]
            .find({"nextRunAt": {"$lte": now}})
            .sort("nextRunAt", 1)
            .limit(limit)
        )
        return [d async for d in cursor]

    async def update(self, job_id: Any, update: Dict[str, Any]) -> None:
        mongo = get_mongo()
        await mongo.db[JOBS_COLLECTION].update_one({"_id": job_id}, update)

    async def delete(self, job_id: Any) -> None:
        mongo = get_mongo()
        await mongo.db[JOBS_COLLECTION].delete_one({"_id": job_id})

