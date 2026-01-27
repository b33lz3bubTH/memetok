import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleMute, setActiveVideoId } from '@/store/slices/uiSlice';
import { toggleLike, setLikesCount, setLikedState } from '@/store/slices/feedSlice';
import { VideoPost } from '@/config/appConfig';
import { Volume2, VolumeX, Play, Loader2, Heart } from 'lucide-react';
import VideoSidebar from './VideoSidebar';
import VideoOverlay from './VideoOverlay';
import { PreloadStrategy } from '@/hooks/useVideoPreload';
import { media as mediaApi, postsApi } from '@/lib/api';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useAuth } from '@clerk/clerk-react';
import gsap from 'gsap';

interface VideoCardProps {
  video: VideoPost;
  isActive: boolean;
  dataIndex?: number;
  preloadStrategy?: PreloadStrategy;
  isNextUp?: boolean;
}

const VideoCard = ({ 
  video, 
  isActive, 
  dataIndex, 
  preloadStrategy = 'auto',
  isNextUp = false 
}: VideoCardProps) => {
  const dispatch = useAppDispatch();
  const { isMuted } = useAppSelector((state) => state.ui);
  const likedVideos = useAppSelector((state) => state.feed.likedVideos);
  const isLiked = likedVideos.includes(video.id);
  const { getToken } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const likeAnimationRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLocalPlayIcon, setShowLocalPlayIcon] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [canPlay, setCanPlay] = useState(false);

  const videoUrl = video.postVideos[0]?.videoUrl || '';
  const mediaItems = video.media || (video.mediaId ? [{ type: video.mediaType || 'image', id: video.mediaId }] : []);
  const firstMedia = mediaItems[0];
  const isImage = firstMedia?.type === 'image' || video.mediaType === 'image';
  const imageItems = mediaItems.filter(m => m.type === 'image');
  const hasMultipleImages = imageItems.length > 1;
  const imageUrl = firstMedia && firstMedia.type === 'image' ? mediaApi.imageUrl(firstMedia.id) : (video.mediaId ? mediaApi.imageUrl(video.mediaId) : video.extras.thumbnail);

  // Track buffer progress
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || isImage) return;

    const handleProgress = () => {
      if (videoElement.buffered.length > 0) {
        const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
        const duration = videoElement.duration;
        if (duration > 0) {
          const progress = (bufferedEnd / duration) * 100;
          setBufferProgress(Math.min(progress, 100));
          
          // Log for debugging (Next Up video)
          if (isNextUp && progress > 0) {
            console.log(`📦 Buffering Video ${dataIndex}: ${progress.toFixed(1)}%`);
          }
        }
      }
    };

    const handleCanPlay = () => {
      setCanPlay(true);
      setIsBuffering(false);
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handlePlaying = () => {
      setIsBuffering(false);
    };

    videoElement.addEventListener('progress', handleProgress);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('playing', handlePlaying);

    return () => {
      videoElement.removeEventListener('progress', handleProgress);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('playing', handlePlaying);
    };
  }, [isNextUp, dataIndex]);

  // Play/pause based on active state
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || isImage) {
      if (isActive) dispatch(setActiveVideoId(video.id));
      setIsPlaying(false);
      setIsBuffering(false);
      setCanPlay(true);
      return;
    }

    if (isActive) {
      dispatch(setActiveVideoId(video.id));
      videoElement.play().catch(console.error);
      setIsPlaying(true);
    } else {
      videoElement.pause();
      setIsPlaying(false);
    }
  }, [isActive, dispatch, video.id, isImage]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleVideoHoldStart = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement || isImage) return;

    holdTimerRef.current = setTimeout(() => {
      if (videoElement && !videoElement.paused) {
        videoElement.pause();
        setIsPlaying(false);
        setShowLocalPlayIcon(true);
        setTimeout(() => setShowLocalPlayIcon(false), 1000);
      }
    }, 300);
  }, [isImage]);

  const handleVideoHoldEnd = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const handleVideoClick = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement || isImage) return;

    if (videoElement.paused) {
      videoElement.play().catch(console.error);
      setIsPlaying(true);
      setShowLocalPlayIcon(false);
    }
  }, [isImage]);

  const handleMuteToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(toggleMute());
  }, [dispatch]);

  const handleDoubleTap = useCallback(async () => {
    // Show like animation
    setShowLikeAnimation(true);
    
    // Toggle like
    dispatch(toggleLike(video.id));

    // Call backend
    const token = await getToken();
    if (token) {
      try {
        const res = await postsApi.toggleLike(video.id, token);
        dispatch(setLikesCount({ videoId: video.id, likes: res.likes }));
        dispatch(setLikedState({ videoId: video.id, liked: res.liked }));
      } catch {
        // ignore (optimistic state stays)
      }
    }

    // Wait for DOM to update
    setTimeout(() => {
      if (!likeAnimationRef.current) return;
      
      const heart = likeAnimationRef.current.querySelector('svg') as SVGElement;
      if (!heart) return;
      
      // Reset initial state
      gsap.set(likeAnimationRef.current, { scale: 0, opacity: 1 });
      gsap.set(heart, { fill: '#ffffff', stroke: '#ffffff' });
      
      // Step 1: Scale up and change color
      gsap.to(likeAnimationRef.current, {
        scale: 1.3,
        duration: 0.3,
        ease: 'back.out(1.7)',
        onComplete: () => {
          // Step 2: Change color to red
          gsap.to(heart, {
            fill: '#ef4444',
            stroke: '#ef4444',
            duration: 0.2,
            onComplete: () => {
              // Step 3: Wait a bit, then shrink
              setTimeout(() => {
                if (!likeAnimationRef.current) return;
                gsap.to(likeAnimationRef.current, {
                  scale: 0.6,
                  duration: 0.3,
                  ease: 'power2.in',
                  onComplete: () => {
                    // Step 4: Fade away
                    if (!likeAnimationRef.current) return;
                    gsap.to(likeAnimationRef.current, {
                      opacity: 0,
                      duration: 0.5,
                      ease: 'power2.out',
                      onComplete: () => {
                        // Step 5: Hide completely
                        setShowLikeAnimation(false);
                      },
                    });
                  },
                });
              }, 200);
            },
          });
        },
      });
    }, 10);
  }, [dispatch, video.id, getToken]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      e.preventDefault();
      e.stopPropagation();
      handleDoubleTap();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [handleDoubleTap]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleDoubleTap();
  }, [handleDoubleTap]);

  return (
    <div className="video-card" data-index={dataIndex}>
      {/* Thumbnail backdrop while loading */}
      {!canPlay && isActive && !isImage && (
        <div className="absolute inset-0 z-10">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${video.extras.thumbnail})` }}
          />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          </div>
        </div>
      )}

      {/* Media Element */}
      {isImage ? (
        hasMultipleImages ? (
          <div className="absolute inset-0 w-full h-screen flex items-center justify-center">
            <Carousel opts={{ loop: true }} className="w-full h-screen">
              <CarouselContent className="h-screen -ml-0">
                {imageItems.map((item) => (
                  <CarouselItem key={item.id} className="h-screen pl-0 basis-full">
                    <img
                      src={mediaApi.imageUrl(item.id)}
                      className="w-full h-screen object-contain"
                      alt={video.title}
                      onTouchStart={handleTouchStart}
                      onDoubleClick={handleDoubleClick}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2 opacity-70 hover:opacity-100" />
              <CarouselNext className="right-2 opacity-70 hover:opacity-100" />
            </Carousel>
          </div>
        ) : (
          <img
            src={imageUrl}
            className="absolute inset-0 w-full h-full object-contain"
            alt={video.title}
            onClick={handleVideoClick}
            onTouchStart={handleTouchStart}
            onDoubleClick={handleDoubleClick}
          />
        )
      ) : (
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-contain"
          loop
          muted={isMuted}
          playsInline
          preload={preloadStrategy}
          onClick={handleVideoClick}
          onMouseDown={handleVideoHoldStart}
          onMouseUp={handleVideoHoldEnd}
          onMouseLeave={handleVideoHoldEnd}
          onTouchStart={(e) => {
            handleTouchStart(e);
            handleVideoHoldStart();
          }}
          onTouchEnd={handleVideoHoldEnd}
          onDoubleClick={handleDoubleClick}
        />
      )}

      {/* Buffer Progress Bar for Next Up video */}
      {isNextUp && !isImage && bufferProgress < 100 && (
        <div className="absolute bottom-0 left-0 right-0 z-30 h-1 bg-white/20">
          <div 
            className="h-full bg-theme-primary transition-all duration-300 ease-out"
            style={{ 
              width: `${bufferProgress}%`,
              background: 'var(--theme-gradient)'
            }}
          />
          <div className="absolute -top-6 left-2 text-xs text-white/60 font-mono">
            Preloading: {bufferProgress.toFixed(0)}%
          </div>
        </div>
      )}

      {/* Play Icon Overlay */}
      {showLocalPlayIcon && (
        <div className="play-icon-overlay animate-scale-in">
          <div className="play-icon">
            <Play className="w-10 h-10 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Double Tap Like Animation */}
      {showLikeAnimation && (
        <div
          ref={likeAnimationRef}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
        >
          <Heart className="w-24 h-24 text-white fill-white stroke-white drop-shadow-2xl" />
        </div>
      )}

      {/* Buffering indicator for active video */}
      {isActive && !isImage && isBuffering && canPlay && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <Loader2 className="w-8 h-8 text-white/80 animate-spin" />
        </div>
      )}

      {/* Mute Button */}
      {!isImage && (
        <button
          onClick={handleMuteToggle}
          className="absolute top-4 right-4 z-20 action-btn-icon"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-white" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </button>
      )}

      {/* Right Sidebar Actions */}
      <VideoSidebar video={video} isPlaying={isPlaying} />

      {/* Bottom Overlay */}
      <VideoOverlay video={video} />
    </div>
  );
};

export default VideoCard;
