import { env } from '@/lib/env';

export type MediaType = 'video' | 'image';

export type Post = {
  id: string;
  mediaId: string;
  mediaType: MediaType;
  caption: string;
  tags: string[];
  status: 'pending' | 'posted';
  createdAt: string;
  author: { userId: string };
  stats: { likes: number; comments: number };
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
    file: File,
    opts?: { onProgress?: (pct: number) => void; signal?: AbortSignal }
  ): Promise<{ id: string; stored_name?: string; status?: string }> {
    const streamlanderBase = env.streamlanderBaseUrl.replace(/\/$/, '');
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${streamlanderBase}/upload`);
      xhr.responseType = 'json';

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.max(0, Math.min(100, (e.loaded / e.total) * 100));
        opts?.onProgress?.(pct);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve((xhr.response ?? {}) as { id: string; stored_name?: string; status?: string });
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
      fd.append('file', file);
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
  async create(input: { mediaId: string; mediaType: MediaType; caption: string; tags: string[] }, token: string) {
    return apiFetch<Post>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { Authorization: `Bearer ${token}` },
    });
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
};

