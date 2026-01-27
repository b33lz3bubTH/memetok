from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

import httpx
import jwt

from config.config import settings


class AuthError(Exception):
    pass


@dataclass
class JwksCache:
    jwks: Optional[Dict[str, Any]] = None
    expires_at: float = 0.0


_cache = JwksCache()


async def _get_jwks() -> Dict[str, Any]:
    if _cache.jwks and _cache.expires_at > time.time():
        return _cache.jwks

    if not settings.clerk_jwks_url:
        raise AuthError("CLERK_JWKS_URL not configured")

    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(settings.clerk_jwks_url)
        resp.raise_for_status()
        jwks = resp.json()

    _cache.jwks = jwks
    _cache.expires_at = time.time() + 60 * 10
    return jwks


async def verify_clerk_bearer_token(token: str) -> str:
    if settings.auth_disabled:
        return "dev-user"

    if not settings.clerk_issuer:
        raise AuthError("CLERK_ISSUER not configured")

    jwks = await _get_jwks()
    try:
        unverified = jwt.get_unverified_header(token)
        kid = unverified.get("kid")
        if not kid:
            raise AuthError("missing kid")
    except Exception as e:  # noqa: BLE001
        raise AuthError("invalid token header") from e

    key = None
    for k in jwks.get("keys", []):
        if k.get("kid") == kid:
            key = k
            break
    if not key:
        raise AuthError("unknown kid")

    try:
        claims = jwt.decode(
            token,
            jwt.algorithms.RSAAlgorithm.from_jwk(key),
            algorithms=["RS256"],
            issuer=settings.clerk_issuer,
            options={"verify_aud": False},
        )
    except Exception as e:  # noqa: BLE001
        raise AuthError("token verification failed") from e

    sub = claims.get("sub")
    if not sub:
        raise AuthError("missing sub")
    return str(sub)

