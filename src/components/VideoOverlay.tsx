import { VideoPost } from '@/config/appConfig';
import { useAppSelector } from '@/store/hooks';

interface VideoOverlayProps {
  video: VideoPost;
}

const VideoOverlay = ({ video }: VideoOverlayProps) => {
  const { isCommentDrawerOpen, activeVideoId } = useAppSelector((state) => state.ui);
  const isCommentsOpen = isCommentDrawerOpen && activeVideoId === video.id;
  const hasDescription = video.description && video.description.trim().length > 0;

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
