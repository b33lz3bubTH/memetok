from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


MediaType = Literal["video", "image"]


class CreatePostRequest(BaseModel):
    mediaId: str = Field(min_length=1)
    mediaType: MediaType
    caption: str = Field(default="", max_length=300)
    tags: List[str] = Field(default_factory=list, max_length=20)


class AuthorDTO(BaseModel):
    userId: str


class StatsDTO(BaseModel):
    likes: int
    comments: int


class PostDTO(BaseModel):
    id: str
    mediaId: str
    mediaType: MediaType
    caption: str
    tags: List[str]
    status: Literal["pending", "posted"]
    createdAt: datetime
    author: AuthorDTO
    stats: StatsDTO


class ListPostsResponse(BaseModel):
    items: List[PostDTO]
    take: int
    skip: int


class CommentCreateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=300)


class CommentDTO(BaseModel):
    id: str
    postId: str
    userId: str
    text: str
    createdAt: datetime


class ListCommentsResponse(BaseModel):
    items: List[CommentDTO]
    take: int
    skip: int


class ToggleLikeResponse(BaseModel):
    postId: str
    liked: bool
    likes: int

