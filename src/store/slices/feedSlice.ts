import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { VideoPost } from '@/config/appConfig';
import { media, postsApi, Post as ApiPost } from '@/lib/api';
import { cache } from '@/lib/cache';

interface FeedState {
  videos: VideoPost[];
  currentVideoIndex: number;
  likedVideos: string[];
  isLoading: boolean;
  isLoadingMore: boolean;
  skip: number;
  hasMore: boolean;
}

const initialState: FeedState = {
  videos: [],
  currentVideoIndex: 0,
  likedVideos: [],
  isLoading: true,
  isLoadingMore: false,
  skip: 0,
  hasMore: true,
};

const toVideoPost = (p: ApiPost, stats?: { likes: number; comments: number }): VideoPost => {
  const defaultStats = stats || { likes: 0, comments: 0 };
  const username = p.author?.username || (p.author?.userId ? `user_${p.author.userId.slice(-6)}` : 'user');
  const avatar = p.author?.profilePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
  
  const mediaItems = p.media || [];
  const firstMedia = mediaItems[0];
  const isVideo = firstMedia?.type === 'video';
  
  return {
    id: p.id,
    media: mediaItems,
    mediaId: firstMedia?.id,
    mediaType: firstMedia?.type,
    url: `/post/${p.id}`,
    title: p.caption?.slice(0, 24) || 'Post',
    description: p.description || p.caption || '',
    extras: {
      tags: p.tags || [],
      title: p.caption?.slice(0, 40) || 'Post',
      thumbnail: firstMedia ? (isVideo ? media.thumbUrl(firstMedia.id) : media.imageUrl(firstMedia.id)) : '',
    },
    postVideos: mediaItems
      .filter(m => m.type === 'video')
      .map(m => ({ videoUrl: media.videoUrl(m.id) })),
    stats: {
      likes: defaultStats.likes,
      comments: defaultStats.comments,
      shares: 0,
    },
    author: {
      username,
      avatar,
    },
  };
};

export const fetchFeed = createAsyncThunk('feed/fetchFeed', async (initialCount: number) => {
  const res = await postsApi.list(initialCount, 0);
  const videos = res.items.map((post) => {
    return toVideoPost(post);
  });
  
  return { videos, skip: res.items.length, hasMore: res.items.length === initialCount };
});

export const fetchMoreFeed = createAsyncThunk('feed/fetchMoreFeed', async ({ take, skip }: { take: number; skip: number }) => {
  const res = await postsApi.list(take, skip);
  const videos = res.items.map((post) => {
    return toVideoPost(post);
  });
  
  return { videos, skip: skip + res.items.length, hasMore: res.items.length === take };
});

export const fetchPostStats = createAsyncThunk('feed/fetchPostStats', async (postId: string) => {
  let stats = await cache.getStats(postId);
  if (!stats) {
    const statsRes = await postsApi.getStats(postId);
    stats = statsRes.stats;
    await cache.saveStats(stats);
  }
  return { postId, stats };
});

const feedSlice = createSlice({
  name: 'feed',
  initialState,
  reducers: {
    loadVideos: (state) => {
      state.isLoading = true;
    },
    setVideos: (state, action: PayloadAction<VideoPost[]>) => {
      state.videos = action.payload;
      state.isLoading = false;
    },
    setCurrentVideoIndex: (state, action: PayloadAction<number>) => {
      state.currentVideoIndex = action.payload;
    },
    toggleLike: (state, action: PayloadAction<string>) => {
      const videoId = action.payload;
      const isLiked = state.likedVideos.includes(videoId);
      
      if (isLiked) {
        state.likedVideos = state.likedVideos.filter(id => id !== videoId);
        const video = state.videos.find(v => v.id === videoId);
        if (video) video.stats.likes -= 1;
      } else {
        state.likedVideos.push(videoId);
        const video = state.videos.find(v => v.id === videoId);
        if (video) video.stats.likes += 1;
      }
    },
    setLikesCount: (state, action: PayloadAction<{ videoId: string; likes: number }>) => {
      const { videoId, likes } = action.payload;
      const video = state.videos.find(v => v.id === videoId);
      if (video) video.stats.likes = likes;
    },
    setLikedState: (state, action: PayloadAction<{ videoId: string; liked: boolean }>) => {
      const { videoId, liked } = action.payload;
      const has = state.likedVideos.includes(videoId);
      if (liked && !has) state.likedVideos.push(videoId);
      if (!liked && has) state.likedVideos = state.likedVideos.filter(id => id !== videoId);
    },
    incCommentsCount: (state, action: PayloadAction<{ videoId: string; delta: number }>) => {
      const { videoId, delta } = action.payload;
      const video = state.videos.find(v => v.id === videoId);
      if (video) video.stats.comments += delta;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchFeed.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(fetchFeed.fulfilled, (state, action) => {
      state.videos = action.payload.videos;
      state.skip = action.payload.skip;
      state.hasMore = action.payload.hasMore;
      state.isLoading = false;
    });
    builder.addCase(fetchFeed.rejected, (state) => {
      state.isLoading = false;
    });
    builder.addCase(fetchMoreFeed.pending, (state) => {
      state.isLoadingMore = true;
    });
    builder.addCase(fetchMoreFeed.fulfilled, (state, action) => {
      const existingIds = new Set(state.videos.map(v => v.id));
      const newVideos = action.payload.videos.filter(v => !existingIds.has(v.id));
      state.videos = [...state.videos, ...newVideos];
      state.skip = action.payload.skip;
      state.hasMore = action.payload.hasMore;
      state.isLoadingMore = false;
    });
    builder.addCase(fetchMoreFeed.rejected, (state) => {
      state.isLoadingMore = false;
    });
    builder.addCase(fetchPostStats.fulfilled, (state, action) => {
      const { postId, stats } = action.payload;
      const video = state.videos.find((v) => v.id === postId);
      if (video) {
        video.stats.likes = stats.likes;
        video.stats.comments = stats.comments;
      }
    });
  },
});

export const {
  loadVideos,
  setVideos,
  setCurrentVideoIndex,
  toggleLike,
  setLikesCount,
  setLikedState,
  incCommentsCount,
} = feedSlice.actions;
export default feedSlice.reducer;
