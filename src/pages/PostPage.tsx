import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';
import { postsApi, Post } from '@/lib/api';
import { media } from '@/lib/api';
import { VideoPost } from '@/config/appConfig';
import VideoCard from '@/components/VideoCard';
import CommentDrawer from '@/components/CommentDrawer';
import { useAppDispatch } from '@/store/hooks';
import { initializeTheme } from '@/store/slices/themeSlice';
import { useAppSelector } from '@/store/hooks';
import Loader from '@/components/Loader';

const toVideoPost = (p: Post, stats?: { likes: number; comments: number }): VideoPost => {
  const defaultStats = stats || { likes: 0, comments: 0 };
  const username = p.author?.username || (p.author?.userId ? `user_${p.author.userId.slice(-6)}` : 'user');
  const avatar = p.author?.profilePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
  
  const mediaItems = p.media || [];
  const firstMedia = mediaItems[0];
  const isVideo = firstMedia?.type === 'video';
  
  return {
    id: p.id,
    media: mediaItems,
    mediaId: firstMedia?.id,
    mediaType: firstMedia?.type,
    url: `/post/${p.id}`,
    title: p.caption?.slice(0, 24) || 'Post',
    description: p.description || p.caption || '',
    extras: {
      tags: p.tags || [],
      title: p.caption?.slice(0, 40) || 'Post',
      thumbnail: firstMedia ? (isVideo ? media.thumbUrl(firstMedia.id) : media.imageUrl(firstMedia.id)) : '',
    },
    postVideos: mediaItems
      .filter(m => m.type === 'video')
      .map(m => ({ videoUrl: media.videoUrl(m.id) })),
    stats: {
      likes: defaultStats.likes,
      comments: defaultStats.comments,
      shares: 0,
    },
    author: {
      username,
      avatar,
    },
  };
};

const PostPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentTheme } = useAppSelector((state) => state.theme);
  const [post, setPost] = useState<Post | null>(null);
  const [stats, setStats] = useState<{ likes: number; comments: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    dispatch(initializeTheme());
  }, [dispatch]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', currentTheme.primary);
    root.style.setProperty('--theme-secondary', currentTheme.secondary);
    root.style.setProperty('--theme-text', currentTheme.text);
    root.style.setProperty('--theme-background', currentTheme.background);
    root.style.setProperty('--theme-accent', currentTheme.accent);
    root.style.setProperty('--theme-gradient', currentTheme.gradient);
  }, [currentTheme]);

  useEffect(() => {
    if (!postId) return;

    const fetchPost = async () => {
      try {
        setIsLoading(true);
        const p = await postsApi.get(postId);
        setPost(p);
        
        try {
          const statsRes = await postsApi.getStats(postId);
          setStats(statsRes.stats);
        } catch {
          setStats({ likes: 0, comments: 0 });
        }
      } catch (err) {
        console.error('Failed to fetch post:', err);
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [postId, navigate]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (isLoading) {
    return <Loader themeName={currentTheme.name} />;
  }

  if (!post) return null;

  const videoPost = toVideoPost(post, stats || undefined);

  return (
    <div className="relative w-full h-screen flex justify-center bg-background overflow-hidden" style={{ overflow: 'hidden' }}>
      <div className="w-full max-w-[450px] h-full relative overflow-hidden">
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 z-50 glass px-3 py-2 rounded-full flex items-center gap-2 text-white/90 hover:opacity-90 transition-opacity"
        >
          <Home className="w-5 h-5" />
          <span className="text-sm font-medium">Home</span>
        </button>

        <div className="video-feed-container h-full" style={{ overflow: 'hidden', height: '100vh', scrollSnapType: 'none' }}>
          <VideoCard video={videoPost} isActive={true} />
        </div>

        <CommentDrawer />
      </div>
    </div>
  );
};

export default PostPage;

