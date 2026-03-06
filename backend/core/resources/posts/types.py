from __future__ import annotations

from datetime import datetime
from typing import Literal, NotRequired, TypedDict


PostStatus = Literal["pending", "posted", "failed", "deleted"]
MediaType = Literal["video", "image"]


class AuthorDoc(TypedDict, total=False):
    userId: str
    username: str
    profilePhoto: str


class MediaItemDoc(TypedDict):
    type: MediaType
    id: str


class StatsDoc(TypedDict):
    likes: int
    comments: int


class PostDoc(TypedDict, total=False):
    id: str
    media: list[MediaItemDoc]
    caption: str
    description: str
    tags: list[str]
    status: PostStatus
    createdAt: datetime
    author: AuthorDoc
    stats: StatsDoc
    likedByUser: bool
    savedByUser: bool
    error: str


class ReactionDoc(TypedDict):
    postId: str
    userId: str
    createdAt: datetime


class CommentDoc(TypedDict, total=False):
    id: str
    postId: str
    userId: str
    text: str
    firstName: NotRequired[str | None]
    createdAt: datetime
