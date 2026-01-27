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
  async upload(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${apiBase}/api/media/upload`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as { id: string; stored_name?: string; status?: string };
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

