import { env } from '@/lib/env';
import { PostsQueryAction, PostsMutationAction, UploadersQueryAction, UploadersMutationAction } from '@/lib/actions';

type RequestType = 'query' | 'mutation';

type QueryPayload = {
  [PostsQueryAction.LIST_POSTS]: { take?: number; skip?: number };
  [PostsQueryAction.GET_POST]: { postId: string };
  [PostsQueryAction.LIST_USER_POSTS]: { userId: string; email?: string; take?: number; skip?: number };
  [PostsQueryAction.GET_POST_STATS]: { postId: string };
  [PostsQueryAction.LIST_COMMENTS]: { postId: string; take?: number; skip?: number };
  [PostsQueryAction.LIST_SAVED_POSTS]: { take?: number; skip?: number };
  [UploadersQueryAction.LIST_UPLOADERS]: {};
  [UploadersQueryAction.GET_UPLOADER]: { uploaderId: string };
  [UploadersQueryAction.VALIDATE_API_KEY]: { email: string; apiKey: string };
  [UploadersQueryAction.GET_MY_ACCESS]: { email?: string };
};

type MutationPayload = {
  [PostsMutationAction.TOGGLE_LIKE]: { postId: string };
  [PostsMutationAction.ADD_COMMENT]: { postId: string; text: string; firstName?: string };
  [PostsMutationAction.TOGGLE_SAVE_POST]: { postId: string };
  [UploadersMutationAction.CREATE_UPLOADER]: { email: string; name?: string };
  [UploadersMutationAction.UPDATE_UPLOADER_STATUS]: { uploaderId: string; status: string };
  [UploadersMutationAction.REVOKE_API_KEY]: { uploaderId: string };
};

class ApiClient {
  private baseUrl: string;
  private token?: string;
  private superAdminKey?: string;

  constructor() {
    this.baseUrl = env.memetokApiBaseUrl.replace(/\/$/, '');
  }

  setToken(token: string | undefined) {
    this.token = token;
  }

  setSuperAdminKey(key: string | undefined) {
    this.superAdminKey = key;
  }

  private async execute<T>(
    type: RequestType,
    action: string,
    payload: Record<string, any> = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.superAdminKey) {
      headers['X-Super-Admin-Key'] = this.superAdminKey;
    }

    const response = await fetch(`${this.baseUrl}/api/execute`, {
      method: 'POST',
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
    listPosts: async (payload: QueryPayload[typeof PostsQueryAction.LIST_POSTS] = {}) => {
      return this.execute<{ items: any[]; take: number; skip: number; total?: number }>(
        'query',
        PostsQueryAction.LIST_POSTS,
        payload
      );
    },

    getPost: async (payload: QueryPayload[typeof PostsQueryAction.GET_POST]) => {
      return this.execute<any>('query', PostsQueryAction.GET_POST, payload);
    },

    listUserPosts: async (payload: QueryPayload[typeof PostsQueryAction.LIST_USER_POSTS]) => {
      return this.execute<{ items: any[]; take: number; skip: number; total?: number }>(
        'query',
        PostsQueryAction.LIST_USER_POSTS,
        payload
      );
    },

    getPostStats: async (payload: QueryPayload[typeof PostsQueryAction.GET_POST_STATS]) => {
      return this.execute<{ stats: any }>('query', PostsQueryAction.GET_POST_STATS, payload);
    },

    listComments: async (payload: QueryPayload[typeof PostsQueryAction.LIST_COMMENTS]) => {
      return this.execute<{ items: any[]; take: number; skip: number }>(
        'query',
        PostsQueryAction.LIST_COMMENTS,
        payload
      );
    },

    listSavedPosts: async (payload: QueryPayload[typeof PostsQueryAction.LIST_SAVED_POSTS] = {}) => {
      return this.execute<{ items: any[]; take: number; skip: number; total?: number }>(
        'query',
        PostsQueryAction.LIST_SAVED_POSTS,
        payload
      );
    },
    
    listUploaders: async (payload: QueryPayload[typeof UploadersQueryAction.LIST_UPLOADERS] = {}) => {
      return this.execute<{ items: any[]; total: number }>(
        'query',
        UploadersQueryAction.LIST_UPLOADERS,
        payload
      );
    },

    getUploader: async (payload: QueryPayload[typeof UploadersQueryAction.GET_UPLOADER]) => {
      return this.execute<any>('query', UploadersQueryAction.GET_UPLOADER, payload);
    },

    validateApiKey: async (payload: QueryPayload[typeof UploadersQueryAction.VALIDATE_API_KEY]) => {
      return this.execute<{ isValid: boolean }>('query', UploadersQueryAction.VALIDATE_API_KEY, payload);
    },

    getMyAccess: async (payload: { email?: string } = {}) => {
      return this.execute<{ userId: string; isUploader: boolean }>('query', UploadersQueryAction.GET_MY_ACCESS, payload);
    },
  };

  mutation = {
    toggleLike: async (payload: MutationPayload[typeof PostsMutationAction.TOGGLE_LIKE]) => {
      return this.execute<{ postId: string; liked: boolean; likes: number }>(
        'mutation',
        PostsMutationAction.TOGGLE_LIKE,
        payload
      );
    },

    addComment: async (payload: MutationPayload[typeof PostsMutationAction.ADD_COMMENT]) => {
      return this.execute<any>('mutation', PostsMutationAction.ADD_COMMENT, payload);
    },

    toggleSavePost: async (payload: MutationPayload[typeof PostsMutationAction.TOGGLE_SAVE_POST]) => {
      return this.execute<{ postId: string; saved: boolean }>('mutation', PostsMutationAction.TOGGLE_SAVE_POST, payload);
    },

    createUploader: async (payload: MutationPayload[typeof UploadersMutationAction.CREATE_UPLOADER]) => {
      return this.execute<any>('mutation', UploadersMutationAction.CREATE_UPLOADER, payload);
    },

    updateUploaderStatus: async (payload: MutationPayload[typeof UploadersMutationAction.UPDATE_UPLOADER_STATUS]) => {
      return this.execute<{ success: boolean }>('mutation', UploadersMutationAction.UPDATE_UPLOADER_STATUS, payload);
    },

    revokeApiKey: async (payload: MutationPayload[typeof UploadersMutationAction.REVOKE_API_KEY]) => {
      return this.execute<{ apiKey: string }>('mutation', UploadersMutationAction.REVOKE_API_KEY, payload);
    },
  };
}

export const apiClient = new ApiClient();
