import { useMemo } from 'react';
import { VideoPost } from '@/config/appConfig';

export type PreloadStrategy = 'auto' | 'metadata' | 'none';

export interface VideoRenderConfig {
  video: VideoPost;
  index: number;
  shouldMount: boolean;
  isActive: boolean;
  preloadStrategy: PreloadStrategy;
  isNextUp: boolean; // n+1 - should show loading progress
  isOnDeck: boolean; // n+2 - metadata only
}

interface UseVideoPreloadReturn {
  renderConfigs: VideoRenderConfig[];
  getPlaceholderStyle: (index: number) => { thumbnail: string } | null;
}

/**
 * Smart Video Preloading Hook
 * 
 * Manages which videos are mounted and their preload strategy based on current index.
 * 
 * Rules:
 * - Active (currentIndex): preload="auto", playing
 * - Next Up (currentIndex + 1): preload="auto", paused (50% buffer)
 * - On Deck (currentIndex + 2): preload="metadata" (headers only)
 * - Previous (currentIndex - 1): kept mounted for quick scroll-back
 * - All others: NOT mounted, show placeholder
 */
export const useVideoPreload = (
  videos: VideoPost[],
  currentIndex: number
): UseVideoPreloadReturn => {
  const renderConfigs = useMemo(() => {
    return videos.map((video, index): VideoRenderConfig => {
      const distance = index - currentIndex;
      
      // Determine if video should be mounted
      // Mount range: [currentIndex - 1, currentIndex + 2]
      const shouldMount = distance >= -1 && distance <= 2;
      
      // Determine preload strategy
      let preloadStrategy: PreloadStrategy = 'none';
      if (distance === 0) {
        // Active video - full preload
        preloadStrategy = 'auto';
      } else if (distance === 1) {
        // Next up - preload auto for instant playback
        preloadStrategy = 'auto';
      } else if (distance === 2) {
        // On deck - metadata only
        preloadStrategy = 'metadata';
      } else if (distance === -1) {
        // Previous - keep metadata for scroll back
        preloadStrategy = 'metadata';
      }
      
      return {
        video,
        index,
        shouldMount,
        isActive: distance === 0,
        preloadStrategy,
        isNextUp: distance === 1,
        isOnDeck: distance === 2,
      };
    });
  }, [videos, currentIndex]);

  const getPlaceholderStyle = (index: number) => {
    const config = renderConfigs[index];
    if (config && !config.shouldMount) {
      return { thumbnail: config.video.extras.thumbnail };
    }
    return null;
  };

  return {
    renderConfigs,
    getPlaceholderStyle,
  };
};

export default useVideoPreload;
