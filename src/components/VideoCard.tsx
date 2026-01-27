import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleMute, setActiveVideoId } from '@/store/slices/uiSlice';
import { VideoPost } from '@/config/appConfig';
import { Volume2, VolumeX, Play, Loader2 } from 'lucide-react';
import VideoSidebar from './VideoSidebar';
import VideoOverlay from './VideoOverlay';
import { PreloadStrategy } from '@/hooks/useVideoPreload';
import { media as mediaApi } from '@/lib/api';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLocalPlayIcon, setShowLocalPlayIcon] = useState(false);
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

  const handleVideoClick = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement || isImage) return;

    if (videoElement.paused) {
      videoElement.play().catch(console.error);
      setIsPlaying(true);
      setShowLocalPlayIcon(false);
    } else {
      videoElement.pause();
      setIsPlaying(false);
      setShowLocalPlayIcon(true);
      setTimeout(() => setShowLocalPlayIcon(false), 1000);
    }
  }, [isImage]);

  const handleMuteToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(toggleMute());
  }, [dispatch]);

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
