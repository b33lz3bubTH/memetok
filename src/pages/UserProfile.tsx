import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Video, ChevronLeft, ChevronRight } from "lucide-react";
import { accessApi, postsApi, Post, media } from "@/lib/api";

type TabKey = "posts" | "saved";

const UserProfile = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<TabKey>("saved");
  const [isUploader, setIsUploader] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPosts, setTotalPosts] = useState(0);

  const take = parseInt(searchParams.get("take") || "2");
  const skip = parseInt(searchParams.get("skip") || "0");

  useEffect(() => {
    if (!user?.id) {
      if (!isLoading && !user) navigate("/");
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const token = await getToken();
        if (token) {
          const [saved, access] = await Promise.all([
            postsApi.listSaved(token, 50, 0),
            accessApi.me(token, user.primaryEmailAddress?.emailAddress),
          ]);
          setSavedPosts(saved.items);
          setIsUploader(access.isUploader);

          if (access.isUploader) {
            const own = await postsApi.listByUser(
              user.id,
              take,
              skip,
              user.primaryEmailAddress?.emailAddress,
            );
            setPosts(own.items);
            setTotalPosts(own.total || 0);
            setTab("posts");
          } else {
            setPosts([]);
            setTab("saved");
          }
        }
      } catch (err) {
        console.error("Failed to fetch profile data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user?.id, navigate, getToken, take, skip]);

  if (!user) return null;
  const activeItems = tab === "posts" ? posts : savedPosts;

  const handlePageChange = (newSkip: number) => {
    setSearchParams({ take: take.toString(), skip: newSkip.toString() });
  };

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <button
            onClick={() => navigate("/")}
            className="mb-4 flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <div className="glass rounded-2xl p-6 flex items-center gap-4">
            {user.imageUrl && (
              <img
                src={user.imageUrl}
                alt={user.fullName || "Profile"}
                className="w-20 h-20 rounded-full object-cover border-2 border-white/10"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                {user.fullName || user.username || "User"}
              </h1>
              <p className="text-white/70 text-sm">
                {user.primaryEmailAddress?.emailAddress}
              </p>
              <p className="text-white/60 text-sm mt-2">
                {isUploader ? `${totalPosts} posts · ` : ""}
                {savedPosts.length} saved
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          {isUploader && (
            <button
              onClick={() => setTab("posts")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${tab === "posts" ? "bg-white text-black shadow-lg" : "bg-white/5 text-white hover:bg-white/10"}`}
            >
              My posts
            </button>
          )}
          <button
            onClick={() => setTab("saved")}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${tab === "saved" ? "bg-white text-black shadow-lg" : "bg-white/5 text-white hover:bg-white/10"}`}
          >
            Saved posts
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
            <p>Loading posts...</p>
          </div>
        ) : activeItems.length === 0 ? (
          <div className="text-center py-20 glass rounded-2xl text-white/40">
            <p>No posts in this section.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeItems.map((post) => {
                const firstMedia = post.media?.[0];
                const isVideo = firstMedia?.type === "video";
                return (
                  <button
                    key={post.id}
                    type="button"
                    className="relative group overflow-hidden rounded-xl bg-black/40 hover:ring-2 ring-white/20 transition-all"
                    onClick={() => navigate(`/post/${post.id}`)}
                  >
                    <div className="relative w-full pt-[130%]">
                      {isVideo ? (
                        <>
                          <img
                            src={
                              firstMedia ? media.thumbUrl(firstMedia.id) : ""
                            }
                            alt={post.caption}
                            className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-full p-1.5 shadow-lg">
                            <Video className="w-3.5 h-3.5 text-white" />
                          </div>
                        </>
                      ) : (
                        <img
                          src={firstMedia ? media.imageUrl(firstMedia.id) : ""}
                          alt={post.caption}
                          className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <p className="text-xs text-white truncate w-full">
                          {post.caption}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pagination Controls for uploader posts */}
            {tab === "posts" && totalPosts > take && (
              <div className="flex items-center justify-center gap-4 py-4">
                <button
                  disabled={skip === 0}
                  onClick={() => handlePageChange(Math.max(0, skip - take))}
                  className="p-2 rounded-full glass disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <div className="text-sm font-medium text-white/70">
                  Page {Math.floor(skip / take) + 1} of{" "}
                  {Math.ceil(totalPosts / take)}
                </div>

                <button
                  disabled={skip + take >= totalPosts}
                  onClick={() => handlePageChange(skip + take)}
                  className="p-2 rounded-full glass disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
