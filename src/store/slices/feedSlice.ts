import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { VideoPost } from '@/config/appConfig';
import { media, postsApi, Post as ApiPost } from '@/lib/api';

interface FeedState {
  videos: VideoPost[];
  currentVideoIndex: number;
  likedVideos: string[];
  isLoading: boolean;
  skip: number;
}

const initialState: FeedState = {
  videos: [],
  currentVideoIndex: 0,
  likedVideos: [],
  isLoading: true,
  skip: 0,
};

const toVideoPost = (p: ApiPost): VideoPost => {
  const username = p.author?.userId ? `user_${p.author.userId.slice(-6)}` : 'user';
  return {
    id: p.id,
    mediaId: p.mediaId,
    mediaType: p.mediaType,
    url: `/post/${p.id}`,
    title: p.caption?.slice(0, 24) || 'Post',
    description: p.caption || '',
    extras: {
      tags: p.tags || [],
      title: p.caption?.slice(0, 40) || 'Post',
      thumbnail: media.thumbUrl(p.mediaId),
    },
    postVideos: [
      {
        videoUrl: p.mediaType === 'video' ? media.videoUrl(p.mediaId) : '',
      },
    ],
    stats: {
      likes: p.stats?.likes ?? 0,
      comments: p.stats?.comments ?? 0,
      shares: 0,
    },
    author: {
      username,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
    },
  };
};

export const fetchFeed = createAsyncThunk('feed/fetchFeed', async () => {
  const res = await postsApi.list(20, 0);
  return res.items.map(toVideoPost);
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
      state.videos = action.payload;
      state.isLoading = false;
    });
    builder.addCase(fetchFeed.rejected, (state) => {
      state.isLoading = false;
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
