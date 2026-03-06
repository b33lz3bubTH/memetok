import { env } from "@/lib/env";
import {
  PostsQueryAction,
  PostsMutationAction,
  UploadersQueryAction,
  UploadersMutationAction,
} from "@/lib/actions";

type RequestType = "query" | "mutation";

type QueryPayload = {
  [PostsQueryAction.LIST_POSTS]: { take?: number; skip?: number };
  [PostsQueryAction.GET_POST]: { postId: string };
  [PostsQueryAction.LIST_USER_POSTS]: {
    userId: string;
    email?: string;
    take?: number;
    skip?: number;
  };
  [PostsQueryAction.GET_POST_STATS]: { postId: string };
  [PostsQueryAction.LIST_COMMENTS]: {
    postId: string;
    take?: number;
    skip?: number;
  };
  [PostsQueryAction.LIST_SAVED_POSTS]: { take?: number; skip?: number };
  [UploadersQueryAction.LIST_UPLOADERS]: Record<string, never>;
  [UploadersQueryAction.GET_UPLOADER]: { uploaderId: string };
  [UploadersQueryAction.VALIDATE_API_KEY]: { email: string; apiKey: string };
  [UploadersQueryAction.GET_MY_ACCESS]: { email?: string };
  [PostsQueryAction.LIST_UPLOAD_ERRORS]: { take?: number; skip?: number; email?: string };
  [PostsQueryAction.LIST_ALL_UPLOAD_ERRORS]: { take?: number; skip?: number };
};

export type ApiAuthor = {
  userId: string;
  username?: string;
  profilePhoto?: string;
};
export type ApiMedia = { type: "video" | "image"; id: string };
export type ApiPost = {
  id: string;
  media: ApiMedia[];
  caption: string;
  description: string;
  tags: string[];
  status: "pending" | "posted" | "failed";
  createdAt: string;
  author: ApiAuthor;
  stats?: { likes: number; comments: number };
  likedByUser?: boolean;
  savedByUser?: boolean;
};
export type ApiComment = {
  id: string;
  postId: string;
  userId: string;
  text: string;
  firstName?: string;
  createdAt: string;
};
export type ApiUploadError = {
  postId: string;
  userId: string;
  filename: string;
  error: string;
  createdAt: string;
  hash?: string;
};

type MutationPayload = {
  [PostsMutationAction.TOGGLE_LIKE]: { postId: string };
  [PostsMutationAction.ADD_COMMENT]: {
    postId: string;
    text: string;
    firstName?: string;
  };
  [PostsMutationAction.TOGGLE_SAVE_POST]: { postId: string };
  [UploadersMutationAction.CREATE_UPLOADER]: { email: string; name?: string };
  [UploadersMutationAction.UPDATE_UPLOADER_STATUS]: {
    uploaderId: string;
    status: string;
  };
  [UploadersMutationAction.REVOKE_API_KEY]: { uploaderId: string };
  [PostsMutationAction.DELETE_POST]: { postId: string };
};

class ApiClient {
  private baseUrl: string;
  private superAdminKey?: string;

  constructor() {
    this.baseUrl = env.memetokApiBaseUrl.replace(/\/$/, "");
  }

  setSuperAdminKey(key: string | undefined) {
    this.superAdminKey = key;
  }

  getSuperAdminKey() {
    return this.superAdminKey;
  }

  private async execute<T>(
    type: RequestType,
    action: string,
    payload: Record<string, unknown> = {},
    opts?: { token?: string },
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (opts?.token) {
      headers["Authorization"] = `Bearer ${opts.token}`;
    }

    if (this.superAdminKey) {
      headers["X-Super-Admin-Key"] = this.superAdminKey;
    }

    const response = await fetch(`${this.baseUrl}/api/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type,
        action,
        payload,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        const errorText = await response.text();
        if (errorText) errorMessage = errorText;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  query = {
    listPosts: async (
      payload: QueryPayload[typeof PostsQueryAction.LIST_POSTS] = {},
    ) => {
      return this.execute<{
        items: ApiPost[];
        take: number;
        skip: number;
        total?: number;
      }>("query", PostsQueryAction.LIST_POSTS, payload);
    },

    getPost: async (
      payload: QueryPayload[typeof PostsQueryAction.GET_POST],
      opts?: { token?: string },
    ) => {
      return this.execute<ApiPost>("query", PostsQueryAction.GET_POST, payload, opts);
    },

    listUserPosts: async (
      payload: QueryPayload[typeof PostsQueryAction.LIST_USER_POSTS],
      opts?: { token?: string },
    ) => {
      return this.execute<{
        items: ApiPost[];
        take: number;
        skip: number;
        total?: number;
      }>("query", PostsQueryAction.LIST_USER_POSTS, payload, opts);
    },

    getPostStats: async (
      payload: QueryPayload[typeof PostsQueryAction.GET_POST_STATS],
    ) => {
      return this.execute<{
        stats: { postId: string; likes: number; comments: number };
      }>("query", PostsQueryAction.GET_POST_STATS, payload);
    },

    listComments: async (
      payload: QueryPayload[typeof PostsQueryAction.LIST_COMMENTS],
    ) => {
      return this.execute<{ items: ApiComment[]; take: number; skip: number }>(
        "query",
        PostsQueryAction.LIST_COMMENTS,
        payload,
      );
    },

    listSavedPosts: async (
      payload: QueryPayload[typeof PostsQueryAction.LIST_SAVED_POSTS] = {},
      opts?: { token?: string },
    ) => {
      return this.execute<{
        items: ApiPost[];
        take: number;
        skip: number;
        total?: number;
      }>("query", PostsQueryAction.LIST_SAVED_POSTS, payload, opts);
    },

    listUploaders: async (
      payload: QueryPayload[typeof UploadersQueryAction.LIST_UPLOADERS] = {},
    ) => {
      return this.execute<{
        items: Array<{
          id: string;
          email: string;
          name?: string;
          status: string;
          createdAt: string;
        }>;
        total: number;
      }>("query", UploadersQueryAction.LIST_UPLOADERS, payload);
    },

    getUploader: async (
      payload: QueryPayload[typeof UploadersQueryAction.GET_UPLOADER],
    ) => {
      return this.execute<{
        id: string;
        email: string;
        name?: string;
        status: string;
        createdAt: string;
      }>("query", UploadersQueryAction.GET_UPLOADER, payload);
    },

    validateApiKey: async (
      payload: QueryPayload[typeof UploadersQueryAction.VALIDATE_API_KEY],
    ) => {
      return this.execute<{ isValid: boolean }>(
        "query",
        UploadersQueryAction.VALIDATE_API_KEY,
        payload,
      );
    },

    getMyAccess: async (
      payload: { email?: string } = {},
      opts?: { token?: string },
    ) => {
      return this.execute<{ userId: string; isUploader: boolean }>(
        "query",
        UploadersQueryAction.GET_MY_ACCESS,
        payload,
        opts,
      );
    },
    listUploadErrors: async (
      payload: QueryPayload[typeof PostsQueryAction.LIST_UPLOAD_ERRORS] = {},
      opts?: { token?: string },
    ) => {
      return this.execute<{
        items: ApiUploadError[];
        take: number;
        skip: number;
        total?: number;
      }>("query", PostsQueryAction.LIST_UPLOAD_ERRORS, payload, opts);
    },
    listAllUploadErrors: async (
      payload: QueryPayload[typeof PostsQueryAction.LIST_ALL_UPLOAD_ERRORS] = {},
    ) => {
      return this.execute<{
        items: ApiUploadError[];
        take: number;
        skip: number;
        total?: number;
      }>("query", PostsQueryAction.LIST_ALL_UPLOAD_ERRORS, payload);
    },
  };

  mutation = {
    toggleLike: async (
      payload: MutationPayload[typeof PostsMutationAction.TOGGLE_LIKE],
      opts?: { token?: string },
    ) => {
      return this.execute<{ postId: string; liked: boolean; likes: number }>(
        "mutation",
        PostsMutationAction.TOGGLE_LIKE,
        payload,
        opts,
      );
    },

    addComment: async (
      payload: MutationPayload[typeof PostsMutationAction.ADD_COMMENT],
      opts?: { token?: string },
    ) => {
      return this.execute<ApiComment>(
        "mutation",
        PostsMutationAction.ADD_COMMENT,
        payload,
        opts,
      );
    },

    toggleSavePost: async (
      payload: MutationPayload[typeof PostsMutationAction.TOGGLE_SAVE_POST],
      opts?: { token?: string },
    ) => {
      return this.execute<{ postId: string; saved: boolean }>(
        "mutation",
        PostsMutationAction.TOGGLE_SAVE_POST,
        payload,
        opts,
      );
    },

    createUploader: async (
      payload: MutationPayload[typeof UploadersMutationAction.CREATE_UPLOADER],
    ) => {
      return this.execute<{
        id: string;
        email: string;
        name?: string;
        status: string;
        createdAt: string;
        apiKey?: string;
        alreadyExists?: boolean;
      }>("mutation", UploadersMutationAction.CREATE_UPLOADER, payload);
    },

    updateUploaderStatus: async (
      payload: MutationPayload[typeof UploadersMutationAction.UPDATE_UPLOADER_STATUS],
    ) => {
      return this.execute<{ success: boolean }>(
        "mutation",
        UploadersMutationAction.UPDATE_UPLOADER_STATUS,
        payload,
      );
    },

    revokeApiKey: async (
      payload: MutationPayload[typeof UploadersMutationAction.REVOKE_API_KEY],
    ) => {
      return this.execute<{ apiKey: string }>(
        "mutation",
        UploadersMutationAction.REVOKE_API_KEY,
        payload,
      );
    },
    deletePost: async (
      payload: MutationPayload[typeof PostsMutationAction.DELETE_POST],
    ) => {
      return this.execute<{ success: boolean }>(
        "mutation",
        PostsMutationAction.DELETE_POST,
        payload,
      );
    },
  };
}

export const apiClient = new ApiClient();
