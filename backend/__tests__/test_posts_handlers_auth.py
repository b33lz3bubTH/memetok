import asyncio
from fastapi import HTTPException
from types import SimpleNamespace
from unittest.mock import AsyncMock

from core.resources.posts.actions import PostsMutationAction
from core.resources.posts.handlers import register_posts_handlers
from core.services.cqrs.handler_registry import mutation_registry


def test_toggle_like_requires_authenticated_user():
    async def _run():
        svc = SimpleNamespace(toggle_like=AsyncMock())
        register_posts_handlers(svc)
        handler = mutation_registry.get(PostsMutationAction.TOGGLE_LIKE)

        try:
            await handler({"postId": "p1", "__auth": {"authenticated": False, "user": None}})
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 401
        svc.toggle_like.assert_not_called()

    asyncio.run(_run())
