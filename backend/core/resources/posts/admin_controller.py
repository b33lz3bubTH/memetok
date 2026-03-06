from __future__ import annotations

import hmac
from typing import Any, Dict, List

from fastapi import APIRouter, Header, HTTPException, Query

from config.config import settings
from core.resources.posts.upload_errors_repository import UploadErrorsRepository

router = APIRouter(tags=["admin"])
repo = UploadErrorsRepository()


@router.get("/admin/upload-errors")
async def get_upload_errors(
    limit: int = Query(default=50, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    x_super_admin_key: str = Header(default=None, alias="X-Super-Admin-Key"),
):
    if not x_super_admin_key or not hmac.compare_digest(x_super_admin_key, settings.super_admin_api_key):
        raise HTTPException(status_code=403, detail="Super admin access denied")

    errors = await repo.find_all(limit=limit, skip=skip)
    total = await repo.count_all()

    # Convert ObjectId to string if necessary, though typical for our mongo_common.py
    # but let's be safe and ensure they are serializable
    for error in errors:
        if "_id" in error:
            error["id"] = str(error.pop("_id"))

    return {
        "items": errors,
        "total": total,
        "limit": limit,
        "skip": skip,
    }
