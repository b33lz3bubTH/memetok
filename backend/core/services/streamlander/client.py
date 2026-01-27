from __future__ import annotations

from typing import Any, Dict, Tuple

import httpx

from config.config import settings


class StreamlanderClient:
    def __init__(self, base_url: str | None = None) -> None:
        self._base_url = (base_url or settings.streamlander_base_url).rstrip("/")

    async def upload(self, filename: str, content_type: str, data: bytes) -> Dict[str, Any]:
        url = f"{self._base_url}/upload"
        files = {"file": (filename, data, content_type)}
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, files=files)
            resp.raise_for_status()
            return resp.json()

    async def media_exists(self, media_id: str) -> bool:
        url = f"{self._base_url}/media/{media_id}"
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                async with client.stream("GET", url) as resp:
                    return resp.status_code == 200
            except httpx.HTTPError:
                return False

