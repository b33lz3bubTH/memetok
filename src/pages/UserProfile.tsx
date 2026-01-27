import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Video } from 'lucide-react';
import { postsApi, Post, media } from '@/lib/api';

const UserProfile = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState<number | null>(null);
  const [skip, setSkip] = useState(0);
  const take = 10;

  useEffect(() => {
    if (!user?.id) {
      navigate('/');
      return;
    }

    const fetchPosts = async (initial = false) => {
      try {
        setIsLoading(true);
        const res = await postsApi.listByUser(user.id, take, initial ? 0 : skip);
        setTotal(res.total ?? null);
        if (initial) {
          setPosts(res.items);
          setSkip(res.items.length);
        } else {
          setPosts((prev) => [...prev, ...res.items]);
          setSkip((prev) => prev + res.items.length);
        }
      } catch (err) {
        console.error('Failed to fetch user posts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts(true);
  }, [user?.id, navigate]);

  const canLoadMore = total == null ? false : skip < total;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="mb-4 flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="glass rounded-2xl p-6 flex items-center gap-4">
            {user.imageUrl && (
              <img
                src={user.imageUrl}
                alt={user.fullName || 'Profile'}
                className="w-20 h-20 rounded-full object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                {user.fullName || user.username || 'User'}
              </h1>
              <p className="text-white/70 text-sm">{user.primaryEmailAddress?.emailAddress}</p>
              <p className="text-white/60 text-sm mt-2">
                {total !== null ? total : posts.length} posts
              </p>
            </div>
          </div>
        </div>

        {/* Posts List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-white/60">Loading posts...</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-white/60 mb-2">No posts yet</div>
            <button
              onClick={() => navigate('/')}
              className="text-primary hover:opacity-90 transition-opacity"
            >
              Create your first post
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {posts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  className="relative group overflow-hidden rounded-xl bg-black/40 focus:outline-none focus:ring-2 focus:ring-primary/60"
                  onClick={() => navigate(`/post/${post.id}`)}
                >
                  <div className="relative w-full pt-[130%]">
                    {(() => {
                      const mediaItems = post.media || (post.mediaId ? [{ type: post.mediaType || 'image', id: post.mediaId }] : []);
                      const firstMedia = mediaItems[0];
                      const isVideo = firstMedia?.type === 'video';
                      return isVideo ? (
                        <>
                          <img
                            src={firstMedia ? media.thumbUrl(firstMedia.id) : ''}
                            alt={post.caption}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                          <div className="absolute top-1 right-1 bg-black/60 rounded-full p-1">
                            <Video className="w-3 h-3 text-white" />
                          </div>
                        </>
                      ) : (
                        <img
                          src={firstMedia ? media.imageUrl(firstMedia.id) : ''}
                          alt={post.caption}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      );
                    })()}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                      <p className="text-[11px] text-white font-medium line-clamp-1">
                        {post.caption || 'Untitled post'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {canLoadMore && (
              <div className="mt-4 flex justify-center">
                <button
                  disabled={isLoading}
                  onClick={async () => {
                    if (!user?.id) return;
                    try {
                      setIsLoading(true);
                      const res = await postsApi.listByUser(user.id, take, skip);
                      setPosts((prev) => [...prev, ...res.items]);
                      setSkip((prev) => prev + res.items.length);
                      if (res.total !== undefined) setTotal(res.total);
                    } catch (err) {
                      console.error('Failed to load more posts:', err);
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  className="px-4 py-2 rounded-full bg-white/10 text-white text-sm hover:bg-white/20 transition-colors disabled:opacity-60"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
