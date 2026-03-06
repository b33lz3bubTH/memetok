import { env } from '@/lib/env';
import { cache } from '@/lib/cache';
import { apiClient, ApiPost, ApiUploadError } from '@/lib/api-client';

export type MediaType = 'video' | 'image';

export type MediaItem = {
  type: MediaType;
  id: string;
};

export type Post = ApiPost;
export type UploadError = ApiUploadError;


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
  firstName?: string;
  createdAt: string;
};

export type SuperAdminUploader = {
  id: string;
  email: string;
  isActive: boolean;
  apiKey?: string;
  alreadyExists?: boolean;
};

export type SuperAdminApiKey = {
  id: string;
  name: string;
  createdAt: string;
  revokedAt?: string | null;
};

const apiBase = env.memetokApiBaseUrl.replace(/\/$/, '');

export const media = {
  async uploadWithProgress(
    files: File[],
    opts?: { onProgress?: (pct: number) => void; signal?: AbortSignal },
    metadata?: { caption: string; description: string; tags: string[]; username?: string; profilePhoto?: string; email: string },
    optsAuth?: { token?: string; uploaderApiKey?: string }
  ): Promise<Post> {
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${apiBase}/api/posts/upload`);
      xhr.responseType = 'json';

      if (optsAuth?.token) {
        xhr.setRequestHeader('Authorization', `Bearer ${optsAuth.token}`);
      }
      
      const uploaderKey = optsAuth?.uploaderApiKey;
      const adminKey = apiClient.getSuperAdminKey();

      if (uploaderKey) {
        xhr.setRequestHeader('X-API-KEY', uploaderKey);
      } else if (adminKey) {
        xhr.setRequestHeader('X-Super-Admin-Key', adminKey);
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
             : (xhr.response as { detail?: string })?.detail || xhr.responseText || `upload failed (${xhr.status})`;
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
        fd.append('email', metadata.email);
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

export const accessApi = {
  async me(token: string, email?: string): Promise<{ userId: string; isUploader: boolean }> {
    return apiClient.query.getMyAccess({ email }, { token });
  },
};

export const superAdminApi = {
  async listUploaders(): Promise<{ items: SuperAdminUploader[] }> {
    const res = await apiClient.query.listUploaders();
    return {
      items: res.items.map((i) => ({
        id: i.id,
        email: i.email,
        isActive: i.status === 'active'
      }))
    };
  },
  async addUploader(email: string, name?: string): Promise<SuperAdminUploader> {
    const res = await apiClient.mutation.createUploader({ email, name });
    return {
      id: res.id,
      email: res.email,
      isActive: res.status === 'active',
      apiKey: res.apiKey,
      alreadyExists: res.alreadyExists
    };
  },
  async listApiKeys(): Promise<{ items: SuperAdminApiKey[] }> {
    // In the new system, API keys are per uploader.
    // However, for compatibility with the old UI, we'll return all uploaders' info or similar.
    // Or just let the UI manage uploaders.
    // The old UI had a separate list of standalone API keys.
    // I'll return an empty list for now or adapt the UI.
    return { items: [] };
  },
  async validateApiKey(email: string, apiKey: string): Promise<{ isValid: boolean }> {
    const res = await apiClient.query.validateApiKey({ email, apiKey });
    return { isValid: res.isValid };
  },
  async createApiKey(uploaderId: string): Promise<{ apiKey: string }> {
    return apiClient.mutation.revokeApiKey({ uploaderId });
  },
  async revokeApiKey(uploaderId: string): Promise<{ revoked: boolean }> {
    // In new system, we just update status to something else if we want to "revoke" the uploader
    // or revoke the single API key they have.
    await apiClient.mutation.revokeApiKey({ uploaderId });
    return { revoked: true };
  },
  async listAllUploadErrors(take = 50, skip = 0) {
    return apiClient.query.listAllUploadErrors({ take, skip });
  },
  setAdminKey(key: string) {
    apiClient.setSuperAdminKey(key);
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
    return apiClient.mutation.toggleLike({ postId }, { token });
  },

  async listComments(postId: string, take = 20, skip = 0) {
    const res = await apiClient.query.listComments({ postId, take, skip });
    await cache.saveComments(res.items);
    return res;
  },

  async addComment(postId: string, text: string, token: string, firstName?: string) {
    return apiClient.mutation.addComment({ postId, text, firstName }, { token });
  },

  async listByUser(userId: string, take = 50, skip = 0, email?: string, token?: string) {
    return apiClient.query.listUserPosts({ userId, take, skip, email }, { token });
  },

  async listSaved(token: string, take = 50, skip = 0) {
    return apiClient.query.listSavedPosts({ take, skip }, { token });
  },

  async toggleSave(postId: string, token: string) {
    return apiClient.mutation.toggleSavePost({ postId }, { token });
  },

  async delete(postId: string) {
    return apiClient.mutation.deletePost({ postId });
  },
  async listUploadErrors(token: string, take = 50, skip = 0, email?: string) {
    return apiClient.query.listUploadErrors({ take, skip, email }, { token });
  },
  _apiClient: apiClient,
};
