import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from core.resources.posts.service import PostsService


def test_list_saved_posts_batch_fetches_and_preserves_order():
    async def _run():
        posts_repo = SimpleNamespace(
            find_by_ids=AsyncMock(return_value=[
                {"id": "p2", "status": "posted", "media": [], "caption": "c2", "description": "", "tags": [], "createdAt": "2024-01-01T00:00:00", "author": {"userId": "u1"}, "stats": {"likes": 1, "comments": 0}},
                {"id": "p1", "status": "posted", "media": [], "caption": "c1", "description": "", "tags": [], "createdAt": "2024-01-01T00:00:00", "author": {"userId": "u1"}, "stats": {"likes": 1, "comments": 0}},
            ])
        )
        service = PostsService(
            posts_repo=posts_repo,
            likes_repo=SimpleNamespace(),
            comments_repo=SimpleNamespace(),
            saved_posts_repo=SimpleNamespace(list_saved_post_ids=AsyncMock(return_value=["p1", "p2"])),
            jobs_service=SimpleNamespace(),
        )

        items = await service.list_saved_posts("u1", take=10, skip=0)

        posts_repo.find_by_ids.assert_awaited_once_with(["p1", "p2"])
        assert [item.id for item in items] == ["p1", "p2"]
        assert all(item.savedByUser for item in items)

    asyncio.run(_run())
