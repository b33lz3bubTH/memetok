export const PostsQueryAction = {
  LIST_POSTS: 'list_posts',
  GET_POST: 'get_post',
  LIST_USER_POSTS: 'list_user_posts',
  GET_POST_STATS: 'get_post_stats',
  LIST_COMMENTS: 'list_comments',
  LIST_SAVED_POSTS: 'list_saved_posts',
} as const;

export const PostsMutationAction = {
  TOGGLE_LIKE: 'toggle_like',
  ADD_COMMENT: 'add_comment',
  TOGGLE_SAVE_POST: 'toggle_save_post',
} as const;

export const UploadersQueryAction = {
  LIST_UPLOADERS: 'list_uploaders',
  GET_UPLOADER: 'get_uploader',
  VALIDATE_API_KEY: 'validate_api_key',
  GET_MY_ACCESS: 'get_my_access',
} as const;

export const UploadersMutationAction = {
  CREATE_UPLOADER: 'create_uploader',
  UPDATE_UPLOADER_STATUS: 'update_uploader_status',
  REVOKE_API_KEY: 'revoke_api_key',
} as const;

export type PostsQueryActionType = typeof PostsQueryAction[keyof typeof PostsQueryAction];
export type PostsMutationActionType = typeof PostsMutationAction[keyof typeof PostsMutationAction];
export type UploadersQueryActionType = typeof UploadersQueryAction[keyof typeof UploadersQueryAction];
export type UploadersMutationActionType = typeof UploadersMutationAction[keyof typeof UploadersMutationAction];
