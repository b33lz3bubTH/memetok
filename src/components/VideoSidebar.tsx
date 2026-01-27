import { useRef, useCallback, useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setLikedState, setLikesCount, toggleLike, fetchPostStats } from '@/store/slices/feedSlice';
import { openCommentDrawer } from '@/store/slices/uiSlice';
import { VideoPost } from '@/config/appConfig';
import { Heart, MessageCircle, Share2, Music } from 'lucide-react';
import gsap from 'gsap';
import { animate } from 'animejs';
import { postsApi } from '@/lib/api';
import { SignInButton, SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import ShareModal from './ShareModal';

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
  const { getToken } = useAuth();

  const [statsLoaded, setStatsLoaded] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    if (!statsLoaded) {
      dispatch(fetchPostStats(video.id));
      setStatsLoaded(true);
    }
  }, [video.id, statsLoaded, dispatch]);

  const handleLike = useCallback(async () => {
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

    const token = await getToken();
    if (!token) return;
    try {
      const res = await postsApi.toggleLike(video.id, token);
      dispatch(setLikesCount({ videoId: video.id, likes: res.likes }));
      dispatch(setLikedState({ videoId: video.id, liked: res.liked }));
      setStatsLoaded(true);
    } catch {
      // ignore (optimistic state stays)
    }
  }, [dispatch, video.id, isLiked, getToken]);

  const handleComment = useCallback(() => {
    dispatch(openCommentDrawer(video.id));
  }, [dispatch, video.id]);

  const handleShare = useCallback(() => {
    setShareModalOpen(true);
  }, []);

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
      <SignedOut>
        <SignInButton mode="modal">
          <button className="action-btn">
            <div ref={heartRef} className="action-btn-icon relative">
              <Heart className="w-7 h-7 transition-colors text-white" fill="none" />
              <div ref={burstContainerRef} className="like-burst-container" />
            </div>
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <button className="action-btn" onClick={handleLike}>
          <div ref={heartRef} className="action-btn-icon relative">
            <Heart
              className={`w-7 h-7 transition-colors ${isLiked ? 'heart-filled' : 'text-white'}`}
              fill={isLiked ? 'currentColor' : 'none'}
            />
            <div ref={burstContainerRef} className="like-burst-container" />
          </div>
        </button>
      </SignedIn>

      {/* Comment Button */}
      <button className="action-btn" onClick={handleComment}>
        <div className="action-btn-icon">
          <MessageCircle className="w-7 h-7 text-white" />
        </div>
      </button>

      {/* Share Button */}
      <button className="action-btn" onClick={handleShare}>
        <div className="action-btn-icon">
          <Share2 className="w-7 h-7 text-white" />
        </div>
      </button>

      {/* Sound Disc */}
      <div
        className={`sound-disc ${isPlaying ? 'sound-disc-rotating' : 'sound-disc-paused'}`}
      >
        <Music className="w-5 h-5 text-white" />
      </div>

      {/* Share Modal */}
      <ShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        postId={video.id}
      />
    </div>
  );
};

export default VideoSidebar;
