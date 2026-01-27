export const PostsQueryAction = {
  LIST_POSTS: 'list_posts',
  GET_POST: 'get_post',
  LIST_USER_POSTS: 'list_user_posts',
  GET_POST_STATS: 'get_post_stats',
  LIST_COMMENTS: 'list_comments',
} as const;

export const PostsMutationAction = {
  TOGGLE_LIKE: 'toggle_like',
  ADD_COMMENT: 'add_comment',
} as const;

export type PostsQueryActionType = typeof PostsQueryAction[keyof typeof PostsQueryAction];
export type PostsMutationActionType = typeof PostsMutationAction[keyof typeof PostsMutationAction];
