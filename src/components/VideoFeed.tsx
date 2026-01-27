import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchFeed, fetchMoreFeed, setCurrentVideoIndex } from '@/store/slices/feedSlice';
import { initializeTheme } from '@/store/slices/themeSlice';
import VideoCard from './VideoCard';
import VideoPlaceholder from './VideoPlaceholder';
import CommentDrawer from './CommentDrawer';
import Loader from './Loader';
import { APP_CONFIG } from '@/config/appConfig';
import { useVideoPreload } from '@/hooks/useVideoPreload';
import CreatePostButton from './CreatePostButton';
import UserProfile from './UserProfile';

const VideoFeed = () => {
  const dispatch = useAppDispatch();
  const { videos, isLoading, isLoadingMore, skip, hasMore, currentVideoIndex } = useAppSelector((state) => state.feed);
  const { currentTheme } = useAppSelector((state) => state.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleVideoIndex, setVisibleVideoIndex] = useState(0);
  const fetchingRef = useRef(false);

  // Use the preload hook for virtualized rendering
  const { renderConfigs } = useVideoPreload(videos, visibleVideoIndex);

  // Initialize theme and feed on mount
  useEffect(() => {
    dispatch(initializeTheme());
    dispatch(fetchFeed(APP_CONFIG.initialPostsToFetch));
  }, [dispatch]);

  // Load more when approaching the end
  const loadMore = useCallback(() => {
    if (fetchingRef.current || !hasMore || isLoadingMore) return;
    
    fetchingRef.current = true;
    dispatch(fetchMoreFeed({ take: APP_CONFIG.postsPerPage, skip })).finally(() => {
      fetchingRef.current = false;
    });
  }, [dispatch, skip, hasMore, isLoadingMore]);

  // Check if we need to load more when visible index changes
  useEffect(() => {
    if (videos.length === 0 || !hasMore) return;
    
    const threshold = videos.length - 1;
    if (visibleVideoIndex >= threshold && !fetchingRef.current) {
      loadMore();
    }
  }, [visibleVideoIndex, videos.length, hasMore, loadMore]);

  // Apply theme colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', currentTheme.primary);
    root.style.setProperty('--theme-secondary', currentTheme.secondary);
    root.style.setProperty('--theme-text', currentTheme.text);
    root.style.setProperty('--theme-background', currentTheme.background);
    root.style.setProperty('--theme-accent', currentTheme.accent);
    root.style.setProperty('--theme-gradient', currentTheme.gradient);
  }, [currentTheme]);

  // Intersection Observer for video visibility
  useEffect(() => {
    if (isLoading || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= APP_CONFIG.intersectionThreshold) {
            const index = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(index)) {
              setVisibleVideoIndex(index);
              dispatch(setCurrentVideoIndex(index));
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: APP_CONFIG.intersectionThreshold,
      }
    );

    const videoCards = containerRef.current.querySelectorAll('.video-card');
    videoCards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, [isLoading, videos, dispatch, renderConfigs]);

  if (isLoading) {
    return <Loader themeName={currentTheme.name} />;
  }

  return (
    <div className="relative w-full h-screen flex justify-center bg-background">
      {/* Mobile Container */}
      <div className="w-full max-w-[450px] h-full relative">
        {/* Video Feed */}
        <div ref={containerRef} className="video-feed-container">
          {videos.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center p-6">
              <div className="glass rounded-2xl p-6 text-center max-w-sm">
                <div className="text-lg font-semibold text-white mb-1">No posts yet</div>
                <div className="text-sm text-white/70">
                  Be the first one to post. Tap <span className="font-semibold">+</span> to upload.
                </div>
              </div>
            </div>
          ) : (
            renderConfigs.map((config) => {
              // Render placeholder for unmounted videos
              if (!config.shouldMount) {
                return <VideoPlaceholder key={config.video.id} video={config.video} dataIndex={config.index} />;
              }

              // Render actual video component
              return (
                <VideoCard
                  key={config.video.id}
                  video={config.video}
                  isActive={config.isActive}
                  dataIndex={config.index}
                  preloadStrategy={config.preloadStrategy}
                  isNextUp={config.isNextUp}
                />
              );
            })
          )}
        </div>

        {/* Comment Drawer */}
        <CommentDrawer />
      </div>

      {/* Theme Indicator (subtle) */}
      <div className="fixed top-4 left-4 z-50">
        <div className="glass px-3 py-1.5 rounded-full">
          <span className="text-xs text-white/70 font-medium">
            {currentTheme.name}
          </span>
        </div>
      </div>

      {/* User Profile */}
      <UserProfile />

      {/* Preload Status Debug (dev only) */}
      {/* {videos.length > 0 && (
        <div className="fixed bottom-4 left-4 z-50">
          <div className="glass px-3 py-2 rounded-lg text-xs text-white/60 font-mono space-y-1">
            <div>Current: {visibleVideoIndex}</div>
            <div>
              Mounted: [{renderConfigs.filter((c) => c.shouldMount).map((c) => c.index).join(', ')}]
            </div>
          </div>
        </div>
      )} */}

      <CreatePostButton />
    </div>
  );
};

export default VideoFeed;
