import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleMute, setPaused, setShowPlayIcon, setActiveVideoId } from '@/store/slices/uiSlice';
import { VideoPost } from '@/config/appConfig';
import { Volume2, VolumeX, Play } from 'lucide-react';
import VideoSidebar from './VideoSidebar';
import VideoOverlay from './VideoOverlay';

interface VideoCardProps {
  video: VideoPost;
  isActive: boolean;
  dataIndex?: number;
}

const VideoCard = ({ video, isActive, dataIndex }: VideoCardProps) => {
  const dispatch = useAppDispatch();
  const { isMuted, showPlayIcon } = useAppSelector((state) => state.ui);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLocalPlayIcon, setShowLocalPlayIcon] = useState(false);

  const videoUrl = video.postVideos[0]?.videoUrl || '';

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isActive) {
      dispatch(setActiveVideoId(video.id));
      videoElement.play().catch(console.error);
      setIsPlaying(true);
    } else {
      videoElement.pause();
      setIsPlaying(false);
    }
  }, [isActive, dispatch, video.id]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleVideoClick = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

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
  }, []);

  const handleMuteToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(toggleMute());
  }, [dispatch]);

  return (
    <div className="video-card" data-index={dataIndex}>
      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        onClick={handleVideoClick}
      />

      {/* Play Icon Overlay */}
      {showLocalPlayIcon && (
        <div className="play-icon-overlay animate-scale-in">
          <div className="play-icon">
            <Play className="w-10 h-10 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Mute Button */}
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

      {/* Right Sidebar Actions */}
      <VideoSidebar video={video} isPlaying={isPlaying} />

      {/* Bottom Overlay */}
      <VideoOverlay video={video} />
    </div>
  );
};

export default VideoCard;
