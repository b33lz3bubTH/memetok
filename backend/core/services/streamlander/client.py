from __future__ import annotations

from typing import Any, Dict

import httpx

from config.config import settings


class StreamlanderClient:
    def __init__(self, base_url: str | None = None) -> None:
        self._base_url = (base_url or settings.streamlander_base_url).rstrip("/")

    async def upload(self, filename: str, content_type: str, data: bytes) -> Dict[str, Any]:
        url = f"{self._base_url}/upload"
        # httpx accepts bytes directly in tuple format: (filename, bytes, content_type)
        # This is the recommended way per httpx documentation
        files = {"file": (filename, data, content_type)}
        async with httpx.AsyncClient(timeout=1600.0) as client:  # Increased timeout for large files
            try:
                resp = await client.post(url, files=files)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                # Try to get error details from response
                error_detail = "Unknown error"
                try:
                    if e.response.content:
                        error_detail = e.response.text[:500]  # Limit error message length
                except:
                    pass
                raise Exception(f"Streamlander upload failed: {e.response.status_code} - {error_detail}") from e

    async def video_ready(self, media_id: str) -> bool:
        """
        A video is considered ready when the /stream endpoint resolves.
        This endpoint returns headers + X-Accel-Redirect (no body), so it's a cheap probe.
        """
        url = f"{self._base_url}/stream/{media_id}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(url)
                return resp.status_code == 200
            except httpx.HTTPError:
                return False

    async def thumbnail_ready(self, media_id: str) -> bool:
        """
        Memetok placeholders use thumb=true. Don't mark posted until thumb is available.
        """
        url = f"{self._base_url}/media/{media_id}?thumb=true"
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                async with client.stream("GET", url) as resp:
                    return resp.status_code == 200
            except httpx.HTTPError:
                return False

    async def media_exists(self, media_id: str) -> bool:
        """
        Simple check: does the media exist at all? Just verify the /media endpoint returns 200.
        This is the basic verification needed - is the post real or not?
        """
        url = f"{self._base_url}/media/{media_id}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                async with client.stream("GET", url) as resp:
                    return resp.status_code == 200
            except httpx.HTTPError:
                return False

    async def media_ready(self, media_id: str, media_type: str | None = None) -> bool:
        if (media_type or "").lower() == "video":
            return await self.video_ready(media_id)
        # images (and unknown types) require thumbnail for UI placeholders
        return await self.thumbnail_ready(media_id)
