import { useEffect, useState, useRef } from 'react';
import { VideoPost } from '@/config/appConfig';
import { useAppSelector } from '@/store/hooks';
import { postsApi, Comment } from '@/lib/api';
import { cache } from '@/lib/cache';

interface VideoOverlayProps {
  video: VideoPost;
}

const VideoOverlay = ({ video }: VideoOverlayProps) => {
  const { isCommentDrawerOpen, activeVideoId } = useAppSelector((state) => state.ui);
  const isCommentsOpen = isCommentDrawerOpen && activeVideoId === video.id;
  const hasDescription = video.description && video.description.trim().length > 0;

  const [comments, setComments] = useState<Comment[]>([]);
  const [currentCommentIndex, setCurrentCommentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (activeVideoId === video.id) {
      (async () => {
        try {
          setCurrentCommentIndex(0);
          setProgress(0);
          const cached = await cache.getComments(video.id);
          if (cached && cached.length > 0) {
            setComments(cached.slice(0, 4));
          } else {
            const r = await postsApi.listComments(video.id, 4, 0);
            setComments(r.items);
          }
        } catch (e) {
          console.error(e);
        }
      })();
    } else {
      setComments([]);
      setCurrentCommentIndex(0);
      setProgress(0);
    }
  }, [activeVideoId, video.id]);

  useEffect(() => {
    if (comments.length <= 1 || isCommentsOpen) {
      setProgress(0);
      return;
    }
    
    let startTime = Date.now();
    let animationFrameId: number;
    const duration = 4000; // 4 seconds per comment
    
    const update = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= duration) {
        startTime = Date.now();
        setCurrentCommentIndex((prev) => (prev + 1) % Math.min(comments.length, 4));
        setProgress(0);
      } else {
        setProgress((elapsed / duration) * 100);
      }
      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [comments.length, isCommentsOpen]);

  const activeCommentIndex = currentCommentIndex >= comments.length ? 0 : currentCommentIndex;
  const activeComment = comments[activeCommentIndex];

  return (
    <div className="absolute bottom-0 left-0 right-16 z-10 p-4 pb-6 w-full">
      {/* Gradient Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'var(--overlay-gradient)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-left">
        {/* Username */}
        <div className="flex items-start justify-start gap-2 mb-2">
          <span className="text-white font-bold text-sm">
            @{video.author.username}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-white font-bold text-base mb-1 line-clamp-1">
          {video.extras.title}
        </h3>

        {/* Description - Expandable 'Show More' logic */}
        {hasDescription && (
          <div className="mb-3 relative group/desc">
            <div 
              className={`text-white/90 text-sm leading-[1.4] pr-4 drop-shadow-md font-normal transition-all duration-300 ease-in-out scrollbar-none
                ${isExpanded ? 'max-h-[250px] overflow-y-auto pb-4' : 'line-clamp-2 overflow-hidden'}`}
            >
              {video.description}
            </div>
            {video.description.length > 80 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-white font-bold text-xs mt-1 bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-sm hover:bg-black/40 transition-colors"
              >
                {isExpanded ? 'Show less' : 'more'}
              </button>
            )}
          </div>
        )}

        {/* Comments Summary (Animated Carousel) */}
        {!isCommentsOpen && comments.length > 0 && activeComment && (
          <div className="mb-4 backdrop-blur-md bg-black/20 border border-white/10 rounded-full py-1.5 pl-2 pr-4 w-max max-w-[85%] flex items-center gap-2 shadow-lg relative overflow-hidden group">
            {comments.length > 1 && (
              <div className="relative w-5 h-5 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" className="text-white/20" />
                  <circle 
                    cx="10" cy="10" r="8" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    fill="none" 
                    className="text-white/90 drop-shadow-[0_0_2px_rgba(255,255,255,0.8)]"
                    strokeDasharray={2 * Math.PI * 8}
                    strokeDashoffset={2 * Math.PI * 8 * (1 - progress / 100)}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            )}
            
            <div className="flex items-center gap-2 overflow-hidden" key={activeComment.id}>
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out fill-mode-both">
                <img
                  src={`https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${activeComment.userId}`}
                  alt={activeComment.firstName || "User"}
                  className="w-5 h-5 rounded-full flex-shrink-0 bg-white/10 border border-white/20 shadow-inner"
                />
                <span className="text-white/90 font-semibold text-xs whitespace-nowrap">
                  {activeComment.firstName || activeComment.userId.slice(-6)}:
                </span>
                <span className="text-white/90 text-xs line-clamp-1 break-all flex-1">
                  {activeComment.text}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-2 justify-start">
          {video.extras.tags.slice(0, 4).map((tag, index) => (
            <span key={index} className="tag-pill">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoOverlay;
