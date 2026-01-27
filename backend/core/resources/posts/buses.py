from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict

from core.services.cqrs.contracts import IBus
from core.services.cqrs.registry import registry
from core.resources.posts.service import PostsService


@dataclass
class PostsQueryBus(IBus):
    svc: PostsService

    async def handle(self, payload: Dict[str, Any]) -> Any:
        take = int(payload.get("take", 10))
        skip = int(payload.get("skip", 0))
        items = await self.svc.list_posts(take=max(1, min(take, 50)), skip=max(0, skip))
        return {"items": [i.model_dump() for i in items], "take": take, "skip": skip}


@dataclass
class PostsCommandBus(IBus):
    svc: PostsService

    async def handle(self, payload: Dict[str, Any]) -> Any:
        action = str(payload.get("action", ""))
        if action == "create":
            user_id = str(payload.get("userId", ""))
            media_id = str(payload.get("mediaId", ""))
            media_type = payload.get("mediaType", "video")
            caption = str(payload.get("caption", ""))
            tags = payload.get("tags", []) or []
            post = await self.svc.create_post(
                user_id=user_id,
                media_id=media_id,
                media_type=media_type,  # type: ignore[arg-type]
                caption=caption,
                tags=tags,  # type: ignore[arg-type]
            )
            return post.model_dump()
        return {"error": "unknown action"}


def register_posts_buses(svc: PostsService) -> None:
    registry.register("PostsQueryBus", PostsQueryBus(svc=svc))
    registry.register("PostsCommandBus", PostsCommandBus(svc=svc))

