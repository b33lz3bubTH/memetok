import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (activeVideoId === video.id) {
      (async () => {
        try {
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
    }
  }, [activeVideoId, video.id]);

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
          <span className="text-white font-bold text-base">
            @{video.author.username}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-white font-bold text-lg mb-1 line-clamp-1">
          {video.extras.title}
        </h3>

        {/* Description - show 2 lines normally, full when comments open */}
        {hasDescription && (
          <p className={`text-white/90 text-sm mb-3 ${isCommentsOpen ? '' : 'line-clamp-2'}`}>
            {video.description}
          </p>
        )}

        {/* Comments Summary */}
        {!isCommentsOpen && comments.length > 0 && (
          <div className="mb-3 space-y-1.5 backdrop-blur-sm bg-black/10 rounded-xl p-2 w-max max-w-[85%]">
            {comments.slice(0, 4).map((comment) => (
              <div key={comment.id} className="flex items-center gap-2">
                <img
                  src={`https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${comment.userId}`}
                  alt={comment.firstName || "User"}
                  className="w-5 h-5 rounded-full flex-shrink-0 bg-white/5 border-white/10"
                />
                <span className="text-white/80 font-medium text-xs whitespace-nowrap">
                  {comment.firstName || comment.userId.slice(-6)}
                </span>
                <span className="text-white text-xs line-clamp-1 break-all">
                  {comment.text}
                </span>
              </div>
            ))}
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
