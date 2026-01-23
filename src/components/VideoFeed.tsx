import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { initializeFeed, setCurrentVideoIndex } from '@/store/slices/feedSlice';
import { initializeTheme } from '@/store/slices/themeSlice';
import VideoCard from './VideoCard';
import CommentDrawer from './CommentDrawer';
import Loader from './Loader';
import { APP_CONFIG } from '@/config/appConfig';

const VideoFeed = () => {
  const dispatch = useAppDispatch();
  const { videos, isLoading, currentVideoIndex } = useAppSelector((state) => state.feed);
  const { currentTheme } = useAppSelector((state) => state.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleVideoIndex, setVisibleVideoIndex] = useState(0);

  // Initialize theme and feed on mount
  useEffect(() => {
    dispatch(initializeTheme());
    dispatch(initializeFeed());
  }, [dispatch]);

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
  }, [isLoading, videos, dispatch]);

  if (isLoading) {
    return <Loader themeName={currentTheme.name} />;
  }

  return (
    <div className="relative w-full h-screen flex justify-center bg-background">
      {/* Mobile Container */}
      <div className="w-full max-w-[450px] h-full relative">
        {/* Video Feed */}
        <div ref={containerRef} className="video-feed-container">
          {videos.map((video, index) => (
            <VideoCard
              key={video.id}
              video={video}
              isActive={index === visibleVideoIndex}
              dataIndex={index}
            />
          ))}
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
    </div>
  );
};

export default VideoFeed;
