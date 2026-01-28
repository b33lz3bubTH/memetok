import { env } from '@/lib/env';
import { cache } from '@/lib/cache';
import { apiClient } from '@/lib/api-client';

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
    const res = await apiClient.query.listPosts({ take, skip });
    await cache.savePosts(res.items);
    return res;
  },

  async get(postId: string) {
    const post = await apiClient.query.getPost({ postId });
    await cache.savePost(post);
    return post;
  },

  async getStats(postId: string) {
    const res = await apiClient.query.getPostStats({ postId });
    await cache.saveStats(res.stats);
    return res;
  },

  async toggleLike(postId: string, token: string) {
    apiClient.setToken(token);
    return apiClient.mutation.toggleLike({ postId });
  },

  async listComments(postId: string, take = 20, skip = 0) {
    const res = await apiClient.query.listComments({ postId, take, skip });
    await cache.saveComments(res.items);
    return res;
  },

  async addComment(postId: string, text: string, token: string) {
    apiClient.setToken(token);
    return apiClient.mutation.addComment({ postId, text });
  },

  async listByUser(userId: string, take = 50, skip = 0) {
    return apiClient.query.listUserPosts({ userId, take, skip });
  },
};
