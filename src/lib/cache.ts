import { Post, PostStats, Comment } from './api';

const DB_NAME = 'memetok-cache';
const DB_VERSION = 1;

const STORES = {
  posts: 'posts',
  stats: 'stats',
  comments: 'comments',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.posts)) {
        const postsStore = db.createObjectStore(STORES.posts, { keyPath: 'id' });
        postsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.stats)) {
        db.createObjectStore(STORES.stats, { keyPath: 'postId' });
      }

      if (!db.objectStoreNames.contains(STORES.comments)) {
        const commentsStore = db.createObjectStore(STORES.comments, { keyPath: 'id' });
        commentsStore.createIndex('postId', 'postId', { unique: false });
        commentsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

export const cache = {
  async getPost(postId: string): Promise<Post | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.posts, 'readonly');
      const store = tx.objectStore(STORES.posts);
      const request = store.get(postId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  async getPosts(limit = 50): Promise<Post[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.posts, 'readonly');
      const store = tx.objectStore(STORES.posts);
      const index = store.index('createdAt');
      const request = index.getAll(null, limit);
      request.onsuccess = () => {
        const posts = request.result || [];
        posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(posts);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async savePost(post: Post): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.posts, 'readwrite');
      const store = tx.objectStore(STORES.posts);
      const request = store.put(post);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async savePosts(posts: Post[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.posts, 'readwrite');
      const store = tx.objectStore(STORES.posts);
      let completed = 0;
      const total = posts.length;

      if (total === 0) {
        resolve();
        return;
      }

      posts.forEach((post) => {
        const request = store.put(post);
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  },

  async getStats(postId: string): Promise<PostStats | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.stats, 'readonly');
      const store = tx.objectStore(STORES.stats);
      const request = store.get(postId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  async saveStats(stats: PostStats): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.stats, 'readwrite');
      const store = tx.objectStore(STORES.stats);
      const request = store.put(stats);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getComments(postId: string): Promise<Comment[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.comments, 'readonly');
      const store = tx.objectStore(STORES.comments);
      const index = store.index('postId');
      const request = index.getAll(postId);
      request.onsuccess = () => {
        const comments = request.result || [];
        comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(comments);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async saveComment(comment: Comment): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.comments, 'readwrite');
      const store = tx.objectStore(STORES.comments);
      const request = store.put(comment);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async saveComments(comments: Comment[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.comments, 'readwrite');
      const store = tx.objectStore(STORES.comments);
      let completed = 0;
      const total = comments.length;

      if (total === 0) {
        resolve();
        return;
      }

      comments.forEach((comment) => {
        const request = store.put(comment);
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  },
};
