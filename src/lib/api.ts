import { env } from '@/lib/env';

export type MediaType = 'video' | 'image';

export type MediaItem = {
  type: MediaType;
  id: string;
};

export type Post = {
  id: string;
  media: MediaItem[];
  caption: string;
  description: string;
  tags: string[];
  status: 'pending' | 'posted';
  createdAt: string;
  author: { userId: string; username?: string; profilePhoto?: string };
};

export type PostStats = {
  postId: string;
  likes: number;
  comments: number;
};

export type Comment = {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: string;
};

const apiBase = env.memetokApiBaseUrl.replace(/\/$/, '');

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const bodyIsForm = init?.body instanceof FormData;
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(bodyIsForm ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    } as HeadersInit,
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

export const media = {
  async uploadWithProgress(
    files: File[],
    opts?: { onProgress?: (pct: number) => void; signal?: AbortSignal },
    metadata?: { caption: string; description: string; tags: string[]; username?: string; profilePhoto?: string },
    token?: string
  ): Promise<Post> {
    const apiBase = env.memetokApiBaseUrl.replace(/\/$/, '');
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${apiBase}/api/posts/upload`);
      xhr.responseType = 'json';

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.max(0, Math.min(100, (e.loaded / e.total) * 100));
        opts?.onProgress?.(pct);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve((xhr.response ?? {}) as Post);
          return;
        }
        const msg =
          typeof xhr.response === 'string'
            ? xhr.response
            : (xhr.response as any)?.detail || xhr.responseText || `upload failed (${xhr.status})`;
        reject(new Error(msg));
      };
      xhr.onerror = () => reject(new Error('upload failed'));
      xhr.onabort = () => reject(new Error('upload aborted'));

      if (opts?.signal) {
        if (opts.signal.aborted) {
          xhr.abort();
          return;
        }
        opts.signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }

      const fd = new FormData();
      for (const file of files) {
        fd.append('files', file);
      }
      if (metadata) {
        fd.append('caption', metadata.caption);
        fd.append('description', metadata.description);
        fd.append('tags', metadata.tags.join(','));
        if (metadata.username) fd.append('username', metadata.username);
        if (metadata.profilePhoto) fd.append('profilePhoto', metadata.profilePhoto);
      }
      xhr.send(fd);
    });
  },
  videoUrl(mediaId: string) {
    return `${env.streamlanderBaseUrl.replace(/\/$/, '')}/stream/${mediaId}`;
  },
  imageUrl(mediaId: string) {
    return `${env.streamlanderBaseUrl.replace(/\/$/, '')}/media/${mediaId}`;
  },
  thumbUrl(mediaId: string) {
    return `${env.streamlanderBaseUrl.replace(/\/$/, '')}/media/${mediaId}?thumb=true`;
  },
};

export const postsApi = {
  async list(take = 10, skip = 0) {
    return apiFetch<{ items: Post[]; take: number; skip: number }>(`/api/posts?take=${take}&skip=${skip}`);
  },
  async create(input: { media: MediaItem[]; caption: string; description: string; tags: string[]; username?: string; profilePhoto?: string }, token: string) {
    return apiFetch<Post>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  async get(postId: string) {
    return apiFetch<Post>(`/api/posts/${postId}`);
  },
  async getStats(postId: string) {
    return apiFetch<{ stats: PostStats }>(`/api/posts/${postId}/stats`);
  },
  async toggleLike(postId: string, token: string) {
    return apiFetch<{ postId: string; liked: boolean; likes: number }>(`/api/posts/${postId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  async listComments(postId: string, take = 20, skip = 0) {
    return apiFetch<{ items: Comment[]; take: number; skip: number }>(
      `/api/posts/${postId}/comments?take=${take}&skip=${skip}`
    );
  },
  async addComment(postId: string, text: string, token: string) {
    return apiFetch<Comment>(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text }),
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  async listByUser(userId: string, take = 50, skip = 0) {
    return apiFetch<{ items: Post[]; take: number; skip: number; total?: number }>(
      `/api/posts/user/${userId}?take=${take}&skip=${skip}`
    );
  },
};

