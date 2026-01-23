import { useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleLike } from '@/store/slices/feedSlice';
import { openCommentDrawer } from '@/store/slices/uiSlice';
import { VideoPost } from '@/config/appConfig';
import { Heart, MessageCircle, Share2, Music } from 'lucide-react';
import gsap from 'gsap';
import { animate } from 'animejs';

interface VideoSidebarProps {
  video: VideoPost;
  isPlaying: boolean;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

const VideoSidebar = ({ video, isPlaying }: VideoSidebarProps) => {
  const dispatch = useAppDispatch();
  const likedVideos = useAppSelector((state) => state.feed.likedVideos);
  const isLiked = likedVideos.includes(video.id);
  const heartRef = useRef<HTMLDivElement>(null);
  const burstContainerRef = useRef<HTMLDivElement>(null);

  const handleLike = useCallback(() => {
    dispatch(toggleLike(video.id));

    // GSAP bounce animation
    if (heartRef.current) {
      gsap.fromTo(
        heartRef.current,
        { scale: 0.8 },
        {
          scale: 1,
          duration: 0.4,
          ease: 'elastic.out(1, 0.3)',
        }
      );
    }

    // Particle burst effect (only when liking)
    if (!isLiked && burstContainerRef.current) {
      const particles: HTMLElement[] = [];
      const container = burstContainerRef.current;

      for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'like-particle';
        particle.style.left = '50%';
        particle.style.top = '50%';
        container.appendChild(particle);
        particles.push(particle);
      }

      animate(particles, {
        translateX: () => (Math.random() - 0.5) * 100,
        translateY: () => (Math.random() - 0.5) * 100,
        scale: [1, 0],
        opacity: [1, 0],
        duration: 600,
        ease: 'outExpo',
        onComplete: () => {
          particles.forEach((p) => p.remove());
        },
      });
    }
  }, [dispatch, video.id, isLiked]);

  const handleComment = useCallback(() => {
    dispatch(openCommentDrawer(video.id));
  }, [dispatch, video.id]);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: video.extras.title,
        text: video.description,
        url: window.location.href,
      }).catch(console.error);
    }
  }, [video]);

  return (
    <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-5">
      {/* Profile Avatar */}
      <div className="avatar-ring mb-2">
        <div className="avatar-inner">
          <img
            src={video.author.avatar}
            alt={video.author.username}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Like Button */}
      <button className="action-btn" onClick={handleLike}>
        <div ref={heartRef} className="action-btn-icon relative">
          <Heart
            className={`w-7 h-7 transition-colors ${
              isLiked ? 'heart-filled' : 'text-white'
            }`}
            fill={isLiked ? 'currentColor' : 'none'}
          />
          <div ref={burstContainerRef} className="like-burst-container" />
        </div>
        <span className="text-white text-xs font-medium">
          {formatNumber(video.stats.likes)}
        </span>
      </button>

      {/* Comment Button */}
      <button className="action-btn" onClick={handleComment}>
        <div className="action-btn-icon">
          <MessageCircle className="w-7 h-7 text-white" />
        </div>
        <span className="text-white text-xs font-medium">
          {formatNumber(video.stats.comments)}
        </span>
      </button>

      {/* Share Button */}
      <button className="action-btn" onClick={handleShare}>
        <div className="action-btn-icon">
          <Share2 className="w-7 h-7 text-white" />
        </div>
        <span className="text-white text-xs font-medium">
          {formatNumber(video.stats.shares)}
        </span>
      </button>

      {/* Sound Disc */}
      <div
        className={`sound-disc ${isPlaying ? 'sound-disc-rotating' : 'sound-disc-paused'}`}
      >
        <Music className="w-5 h-5 text-white" />
      </div>
    </div>
  );
};

export default VideoSidebar;
