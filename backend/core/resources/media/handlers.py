from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from common.app_constants import MAX_IMAGE_BYTES, MAX_VIDEO_BYTES
from core.services.streamlander.client import StreamlanderClient


router = APIRouter(tags=["media"])


async def _read_limited(upload: UploadFile, limit: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise HTTPException(status_code=413, detail="file too large")
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/media/upload")
async def upload_media(file: UploadFile = File(...)):
    content_type = (file.content_type or "").lower()
    filename = file.filename or "upload.bin"

    if content_type in {"video/mp4", "application/mp4"} or filename.lower().endswith(".mp4"):
        data = await _read_limited(file, MAX_VIDEO_BYTES)
    elif content_type.startswith("image/") or any(filename.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]):
        data = await _read_limited(file, MAX_IMAGE_BYTES)
    else:
        raise HTTPException(status_code=400, detail="unsupported media type")

    client = StreamlanderClient()
    try:
        return await client.upload(filename=filename, content_type=content_type or "application/octet-stream", data=data)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="streamlander upload failed") from e

