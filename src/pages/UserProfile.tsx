import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Calendar, FileText, ExternalLink, ChevronLeft, ChevronRight, Video, ArrowLeft } from "lucide-react";
import { accessApi, postsApi, Post, media, UploadError } from "@/lib/api";

type TabKey = "posts" | "saved" | "logs";

const UserProfile = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<TabKey>((searchParams.get("tab") as TabKey) || "saved");
  const [isUploader, setIsUploader] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [uploadErrors, setUploadErrors] = useState<UploadError[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPosts, setTotalPosts] = useState(0);
  const [totalSaved, setTotalSaved] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);

  const take = parseInt(searchParams.get("take") || "12");
  const skip = parseInt(searchParams.get("skip") || "0");

  const [accessChecked, setAccessChecked] = useState(false);
 
  useEffect(() => {
    const rawTab = searchParams.get("tab");
    if (rawTab === "posts" || rawTab === "saved" || rawTab === "logs") {
      setTab(rawTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user?.id) return;
 
    const fetchAccess = async () => {
      try {
        const token = await getToken();
        if (token) {
          const res = await accessApi.me(token, user.primaryEmailAddress?.emailAddress);
          setIsUploader(res.isUploader);
          
          // Set default tab if not present
          if (!searchParams.get("tab")) {
            const defaultTab: TabKey = res.isUploader ? "posts" : "saved";
            setTab(defaultTab);
            setSearchParams({ tab: defaultTab, take: take.toString(), skip: "0" });
          }
        }
      } catch (err) {
        console.error("Error checking access:", err);
      } finally {
        setAccessChecked(true);
      }
    };
 
    fetchAccess();
  }, [user?.id, getToken, searchParams, setSearchParams, take]);
 
  useEffect(() => {
    if (!user?.id || !accessChecked) return;
 
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const token = await getToken();
        if (!token) return;
 
        if (tab === "saved") {
          const res = await postsApi.listSaved(token, take, skip);
          setSavedPosts(res.items);
          setTotalSaved(res.total || 0);
        } else if (tab === "posts" && isUploader) {
          const res = await postsApi.listByUser(
            user.id,
            take,
            skip,
            user.primaryEmailAddress?.emailAddress,
            token
          );
          setPosts(res.items);
          setTotalPosts(res.total || 0);
        } else if (tab === "logs" && isUploader) {
          const res = await postsApi.listUploadErrors(
            token,
            take,
            skip,
            user.primaryEmailAddress?.emailAddress
          );
          setUploadErrors(res.items);
          setTotalErrors(res.total || 0);
        }
      } catch (err) {
        console.error("Failed to fetch profile data:", err);
      } finally {
        setIsLoading(false);
      }
    };
 
    fetchData();
  }, [user?.id, getToken, take, skip, tab, accessChecked, isUploader]);

  if (!user) return null;
  const activeItems = tab === "posts" ? posts : savedPosts;

  const handlePageChange = (newSkip: number) => {
    setSearchParams({ tab, take: take.toString(), skip: newSkip.toString() });
  };

  const handleTabChange = (newTab: TabKey) => {
    setTab(newTab);
    setSearchParams({ tab: newTab, take: take.toString(), skip: "0" });
  };

  const activeItemsCount = tab === "posts" ? totalPosts : tab === "saved" ? totalSaved : totalErrors;
  const currentTotal = tab === "posts" ? totalPosts : tab === "saved" ? totalSaved : totalErrors;

  return (
    <div className="h-screen overflow-y-auto bg-background text-white hide-scrollbar pb-20">
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
                {totalSaved} liked & saved
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          {isUploader && (
            <button
              onClick={() => handleTabChange("posts")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${tab === "posts" ? "bg-white text-black shadow-lg" : "bg-white/5 text-white hover:bg-white/10"}`}
            >
              My posts
            </button>
          )}
          <button
            onClick={() => handleTabChange("saved")}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${tab === "saved" ? "bg-white text-black shadow-lg" : "bg-white/5 text-white hover:bg-white/10"}`}
          >
            Liked & Saved
          </button>
          {isUploader && (
            <button
              onClick={() => handleTabChange("logs")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${tab === "logs" ? "bg-white text-black shadow-lg" : "bg-white/5 text-white hover:bg-white/10"}`}
            >
              Upload Logs
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
            <p>Loading...</p>
          </div>
        ) : tab === "logs" ? (
          <div className="space-y-6">
            {uploadErrors.length === 0 ? (
              <div className="text-center py-20 glass rounded-2xl text-white/40 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <p>No upload errors — all uploads completed successfully ✓</p>
              </div>
            ) : (
              <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5">
                        <th className="px-6 py-4 font-medium text-white/50">File</th>
                        <th className="px-6 py-4 font-medium text-white/50">Error</th>
                        <th className="px-6 py-4 font-medium text-white/50">Post ID</th>
                        <th className="px-6 py-4 font-medium text-white/50">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {uploadErrors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-white/40" />
                              <span className="font-medium">{err.filename}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-start gap-2 text-red-400">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span className="leading-tight">{err.error}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => navigate(`/post/${err.postId}`)}
                              className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors text-xs font-mono"
                            >
                              {err.postId.substring(0, 8)}...
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </td>
                          <td className="px-6 py-4 text-white/40 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(err.createdAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination for logs */}
            {currentTotal > take && (
              <div className="flex items-center justify-center gap-4 py-8">
                <button
                  disabled={skip === 0}
                  onClick={() => handlePageChange(Math.max(0, skip - take))}
                  className="p-3 rounded-full glass disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 active:scale-90 transition-all"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <div className="text-sm font-medium text-white/70">
                  <span className="text-white">Page {Math.floor(skip / take) + 1}</span>
                  <span className="mx-1 text-white/30">/</span>
                  {Math.ceil(currentTotal / take)}
                </div>

                <button
                  disabled={skip + take >= currentTotal}
                  onClick={() => handlePageChange(skip + take)}
                  className="p-3 rounded-full glass disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 active:scale-90 transition-all"
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            )}
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
                const isFailed = post.status === "failed";
                const isPending = post.status === "pending";

                return (
                  <button
                    key={post.id}
                    type="button"
                    className={`relative group overflow-hidden rounded-xl bg-black/40 transition-all ${isFailed ? "ring-2 ring-red-500/50" : "hover:ring-2 ring-white/20"}`}
                    onClick={() => navigate(`/post/${post.id}`)}
                  >
                    <div className="relative w-full pt-[130%]">
                      {isFailed ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-red-500/10 backdrop-blur-sm">
                          <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
                          <span className="text-xs font-medium text-red-200 uppercase tracking-wider">Processing Failed</span>
                          <p className="text-[10px] text-red-200/60 mt-1 line-clamp-2">{post.caption}</p>
                        </div>
                      ) : isPending ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-white/5 backdrop-blur-sm">
                          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3" />
                          <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Processing...</span>
                        </div>
                      ) : isVideo ? (
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
                      
                      {!isFailed && !isPending && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                          <p className="text-xs text-white truncate w-full">
                            {post.caption}
                          </p>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {currentTotal > take && (
              <div className="flex items-center justify-center gap-4 py-8">
                <button
                  disabled={skip === 0}
                  onClick={() => handlePageChange(Math.max(0, skip - take))}
                  className="p-3 rounded-full glass disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 active:scale-90 transition-all"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
 
                <div className="text-sm font-medium text-white/70">
                  <span className="text-white">Page {Math.floor(skip / take) + 1}</span>
                  <span className="mx-1 text-white/30">/</span>
                  {Math.ceil(currentTotal / take)}
                </div>
 
                <button
                  disabled={skip + take >= currentTotal}
                  onClick={() => handlePageChange(skip + take)}
                  className="p-3 rounded-full glass disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 active:scale-90 transition-all"
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
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
