import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { VideoPost, FeedItem } from '@/config/appConfig';
import { media, postsApi, Post as ApiPost } from '@/lib/api';
import { adGenerator, AD_INTERVAL } from '@/config/adConfig';

interface FeedState {
  videos: FeedItem[];
  currentVideoIndex: number;
  likedVideos: string[];
  savedVideos: string[];
  isLoading: boolean;
  isLoadingMore: boolean;
  skip: number;
  hasMore: boolean;
}

const initialState: FeedState = {
  videos: [],
  currentVideoIndex: 0,
  likedVideos: [],
  savedVideos: [],
  isLoading: true,
  isLoadingMore: false,
  skip: 0,
  hasMore: true,
};

const toVideoPost = (p: ApiPost): VideoPost => {
  const defaultStats = p.stats || { likes: 0, comments: 0 };
  const username = p.author?.username || (p.author?.userId ? `user_${p.author.userId.slice(-6)}` : 'user');
  const avatar = p.author?.profilePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
  
  const mediaItems = p.media || [];
  const firstMedia = mediaItems[0];
  const isVideo = firstMedia?.type === 'video';
  
  return {
    id: p.id,
    likedByUser: p.likedByUser,
    savedByUser: p.savedByUser,
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
  const videos = res.items.map((post) => toVideoPost(post));
  const likedVideoIds = res.items.filter((post) => post.likedByUser).map((post) => post.id);
  const savedVideoIds = res.items.filter((post) => post.savedByUser).map((post) => post.id);

  return { videos, likedVideoIds, savedVideoIds, skip: res.items.length, hasMore: res.items.length === initialCount };
});

export const fetchMoreFeed = createAsyncThunk('feed/fetchMoreFeed', async ({ take, skip }: { take: number; skip: number }) => {
  const res = await postsApi.list(take, skip);
  const videos = res.items.map((post) => toVideoPost(post));
  const likedVideoIds = res.items.filter((post) => post.likedByUser).map((post) => post.id);
  const savedVideoIds = res.items.filter((post) => post.savedByUser).map((post) => post.id);

  return { videos, likedVideoIds, savedVideoIds, skip: skip + res.items.length, hasMore: res.items.length === take };
});


const feedSlice = createSlice({
  name: 'feed',
  initialState,
  reducers: {
    loadVideos: (state) => {
      state.isLoading = true;
    },
    setVideos: (state, action: PayloadAction<FeedItem[]>) => {
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
        const item = state.videos.find(v => v.id === videoId);
        if (item && !item.isAd) {
          (item as VideoPost).stats.likes -= 1;
        }
      } else {
        state.likedVideos.push(videoId);
        const item = state.videos.find(v => v.id === videoId);
        if (item && !item.isAd) {
          (item as VideoPost).stats.likes += 1;
        }
      }
    },
    setLikesCount: (state, action: PayloadAction<{ videoId: string; likes: number }>) => {
      const { videoId, likes } = action.payload;
      const item = state.videos.find(v => v.id === videoId);
      if (item && !item.isAd) {
        (item as VideoPost).stats.likes = likes;
      }
    },
    setLikedState: (state, action: PayloadAction<{ videoId: string; liked: boolean }>) => {
      const { videoId, liked } = action.payload;
      const has = state.likedVideos.includes(videoId);
      if (liked && !has) state.likedVideos.push(videoId);
      if (!liked && has) state.likedVideos = state.likedVideos.filter(id => id !== videoId);
      const item = state.videos.find(v => v.id === videoId);
      if (item && !item.isAd) {
        (item as VideoPost).likedByUser = liked;
      }
    },
    setSavedState: (state, action: PayloadAction<{ videoId: string; saved: boolean }>) => {
      const { videoId, saved } = action.payload;
      const has = state.savedVideos.includes(videoId);
      if (saved && !has) state.savedVideos.push(videoId);
      if (!saved && has) state.savedVideos = state.savedVideos.filter(id => id !== videoId);
      const item = state.videos.find(v => v.id === videoId);
      if (item && !item.isAd) {
        (item as VideoPost).savedByUser = saved;
      }
    },
    incCommentsCount: (state, action: PayloadAction<{ videoId: string; delta: number }>) => {
      const { videoId, delta } = action.payload;
      const item = state.videos.find(v => v.id === videoId);
      if (item && !item.isAd) {
        (item as VideoPost).stats.comments += delta;
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchFeed.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(fetchFeed.fulfilled, (state, action) => {
      const videos: FeedItem[] = [];
      const ads = adGenerator();
      
      action.payload.videos.forEach((video, index) => {
        videos.push(video);
        if ((index + 1) % AD_INTERVAL === 0) {
          videos.push(ads.next().value as FeedItem);
        }
      });

      state.videos = videos;
      state.skip = action.payload.skip;
      state.hasMore = action.payload.hasMore;
      state.likedVideos = action.payload.likedVideoIds;
      state.savedVideos = action.payload.savedVideoIds;
      state.isLoading = false;
    });
    builder.addCase(fetchFeed.rejected, (state) => {
      state.isLoading = false;
    });
    builder.addCase(fetchMoreFeed.pending, (state) => {
      state.isLoadingMore = true;
    });
    builder.addCase(fetchMoreFeed.fulfilled, (state, action) => {
      const existingIds = new Set(state.videos.map(v => v.isAd ? v.id : v.id)); // Ads also have IDs
      const newVideos = action.payload.videos.filter(v => !existingIds.has(v.id));
      
      const ads = adGenerator();
      // To maintain round robin across loads, we might need to know how many ads were already shown
      const existingAdsCount = state.videos.filter(v => v.isAd).length;
      // Skip already shown ads in the generator
      for(let i=0; i<existingAdsCount; i++) ads.next();

      const combined: FeedItem[] = [...state.videos];
      const videoCountBefore = state.videos.filter(v => !v.isAd).length;

      newVideos.forEach((video, index) => {
        combined.push(video);
        if ((videoCountBefore + index + 1) % AD_INTERVAL === 0) {
          combined.push(ads.next().value as FeedItem);
        }
      });

      state.videos = combined;
      state.skip = action.payload.skip;
      state.hasMore = action.payload.hasMore;
      state.likedVideos = Array.from(new Set([...state.likedVideos, ...action.payload.likedVideoIds]));
      state.savedVideos = Array.from(new Set([...state.savedVideos, ...action.payload.savedVideoIds]));
      state.isLoadingMore = false;
    });
    builder.addCase(fetchMoreFeed.rejected, (state) => {
      state.isLoadingMore = false;
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
  setSavedState,
  incCommentsCount,
} = feedSlice.actions;
export default feedSlice.reducer;
