import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Video } from 'lucide-react';
import { accessApi, postsApi, Post, media } from '@/lib/api';

type TabKey = 'posts' | 'saved';

const UserProfile = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('saved');
  const [isUploader, setIsUploader] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const token = await getToken();
        if (token) {
          const [saved, access] = await Promise.all([
            postsApi.listSaved(token, 50, 0),
            accessApi.me(token),
          ]);
          setSavedPosts(saved.items);
          setIsUploader(access.isUploader);

          if (access.isUploader) {
            const own = await postsApi.listByUser(user.id, 50, 0);
            setPosts(own.items);
            setTab('posts');
          } else {
            setPosts([]);
            setTab('saved');
          }
        }
      } catch (err) {
        console.error('Failed to fetch profile data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.id, navigate, getToken]);

  if (!user) return null;
  const activeItems = tab === 'posts' ? posts : savedPosts;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <button onClick={() => navigate('/')} className="mb-4 flex items-center gap-2 text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="glass rounded-2xl p-6 flex items-center gap-4">
            {user.imageUrl && <img src={user.imageUrl} alt={user.fullName || 'Profile'} className="w-20 h-20 rounded-full object-cover" />}
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{user.fullName || user.username || 'User'}</h1>
              <p className="text-white/70 text-sm">{user.primaryEmailAddress?.emailAddress}</p>
              <p className="text-white/60 text-sm mt-2">{isUploader ? `${posts.length} posts · ` : ''}{savedPosts.length} saved</p>
            </div>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          {isUploader && <button onClick={() => setTab('posts')} className={`px-4 py-2 rounded-full text-sm ${tab === 'posts' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>My posts</button>}
          <button onClick={() => setTab('saved')} className={`px-4 py-2 rounded-full text-sm ${tab === 'saved' ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>Saved posts</button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-white/60">Loading posts...</div>
        ) : activeItems.length === 0 ? (
          <div className="text-center py-12 text-white/60">No posts in this section.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {activeItems.map((post) => {
              const firstMedia = post.media?.[0];
              const isVideo = firstMedia?.type === 'video';
              return (
                <button key={post.id} type="button" className="relative group overflow-hidden rounded-xl bg-black/40" onClick={() => navigate(`/post/${post.id}`)}>
                  <div className="relative w-full pt-[130%]">
                    {isVideo ? (
                      <>
                        <img src={firstMedia ? media.thumbUrl(firstMedia.id) : ''} alt={post.caption} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute top-1 right-1 bg-black/60 rounded-full p-1"><Video className="w-3 h-3 text-white" /></div>
                      </>
                    ) : (
                      <img src={firstMedia ? media.imageUrl(firstMedia.id) : ''} alt={post.caption} className="absolute inset-0 w-full h-full object-cover" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
