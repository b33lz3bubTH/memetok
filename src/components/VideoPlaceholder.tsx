import { VideoPost } from '@/config/appConfig';

interface VideoPlaceholderProps {
  video: VideoPost;
  dataIndex: number;
}

/**
 * Lightweight placeholder for videos outside the render window.
 * Uses thumbnail image to save memory while maintaining scroll position.
 */
const VideoPlaceholder = ({ video, dataIndex }: VideoPlaceholderProps) => {
  return (
    <div 
      className="video-card"
      data-index={dataIndex}
    >
      {/* Thumbnail Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ 
          backgroundImage: `url(${video.extras.thumbnail})`,
        }}
      />
      
      {/* Blur overlay for style */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      
      {/* Minimal info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white/60 text-sm font-medium truncate">
          {video.extras.title}
        </p>
      </div>
    </div>
  );
};

export default VideoPlaceholder;
