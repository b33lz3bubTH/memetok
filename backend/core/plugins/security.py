"""
Production security middleware for MemeToken backend.

Provides:
- Security response headers (HSTS, CSP, X-Frame-Options, etc.)
- Global IP-based rate limiting (sliding window)
- Request timeout enforcement
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from typing import Callable, Dict, List, Tuple

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from core.logger.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# 1. Security Headers Middleware
# ---------------------------------------------------------------------------

_SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers to every HTTP response."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        for header, value in _SECURITY_HEADERS.items():
            response.headers[header] = value
        return response


# ---------------------------------------------------------------------------
# 2. Global Rate Limiter Middleware (sliding-window, IP-based)
# ---------------------------------------------------------------------------

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    IP-based sliding-window rate limiter.

    Tracks request timestamps per IP and rejects requests that exceed
    `max_requests` within a rolling `window_seconds` period.
    Cleanup of stale entries runs every `_CLEANUP_INTERVAL` seconds.
    """

    _CLEANUP_INTERVAL = 60  # seconds between stale-entry cleanups

    def __init__(self, app, max_requests: int = 600, window_seconds: int = 60, exempt_paths: list[str] | None = None):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.exempt_paths = set(exempt_paths or ["/health"])
        self._buckets: Dict[str, List[float]] = defaultdict(list)
        self._last_cleanup = time.monotonic()

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _cleanup_stale(self, now: float) -> None:
        if now - self._last_cleanup < self._CLEANUP_INTERVAL:
            return
        cutoff = now - self.window_seconds
        stale_keys = [k for k, v in self._buckets.items() if not v or v[-1] < cutoff]
        for k in stale_keys:
            del self._buckets[k]
        self._last_cleanup = now

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.url.path in self.exempt_paths:
            return await call_next(request)

        now = time.monotonic()
        self._cleanup_stale(now)

        client_ip = self._get_client_ip(request)
        bucket = self._buckets[client_ip]
        cutoff = now - self.window_seconds
        # trim old entries
        while bucket and bucket[0] < cutoff:
            bucket.pop(0)

        if len(bucket) >= self.max_requests:
            retry_after = int(self.window_seconds - (now - bucket[0])) + 1
            logger.warning("rate limit exceeded ip=%s count=%d", client_ip, len(bucket))
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": str(retry_after)},
            )

        bucket.append(now)
        return await call_next(request)


# ---------------------------------------------------------------------------
# 3. Request Timeout Middleware
# ---------------------------------------------------------------------------

class RequestTimeoutMiddleware(BaseHTTPMiddleware):
    """Enforces a maximum duration for request handling."""

    def __init__(self, app, timeout_seconds: int = 120):
        super().__init__(app)
        self.timeout_seconds = timeout_seconds

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            return await asyncio.wait_for(call_next(request), timeout=self.timeout_seconds)
        except asyncio.TimeoutError:
            logger.error("request timeout path=%s timeout=%ds", request.url.path, self.timeout_seconds)
            return JSONResponse(
                status_code=504,
                content={"detail": "Request timed out"},
            )
