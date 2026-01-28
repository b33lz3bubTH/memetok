from __future__ import annotations

from enum import Enum


class PostsQueryAction(str, Enum):
    LIST_POSTS = "list_posts"
    GET_POST = "get_post"
    LIST_USER_POSTS = "list_user_posts"
    GET_POST_STATS = "get_post_stats"
    LIST_COMMENTS = "list_comments"


class PostsMutationAction(str, Enum):
    TOGGLE_LIKE = "toggle_like"
    ADD_COMMENT = "add_comment"
