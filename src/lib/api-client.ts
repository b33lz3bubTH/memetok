import { env } from '@/lib/env';
import { PostsQueryAction, PostsMutationAction } from '@/lib/actions';

type RequestType = 'query' | 'mutation';

type QueryPayload = {
  [PostsQueryAction.LIST_POSTS]: { take?: number; skip?: number };
  [PostsQueryAction.GET_POST]: { postId: string };
  [PostsQueryAction.LIST_USER_POSTS]: { userId: string; take?: number; skip?: number };
  [PostsQueryAction.GET_POST_STATS]: { postId: string };
  [PostsQueryAction.LIST_COMMENTS]: { postId: string; take?: number; skip?: number };
};

type MutationPayload = {
  [PostsMutationAction.TOGGLE_LIKE]: { postId: string };
  [PostsMutationAction.ADD_COMMENT]: { postId: string; text: string };
};

class ApiClient {
  private baseUrl: string;
  private token?: string;

  constructor() {
    this.baseUrl = env.memetokApiBaseUrl.replace(/\/$/, '');
  }

  setToken(token: string | undefined) {
    this.token = token;
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
  };
}

export const apiClient = new ApiClient();
