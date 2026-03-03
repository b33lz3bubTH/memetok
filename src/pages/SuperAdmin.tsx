import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Trash2,
  Key,
  Users,
  Film,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { superAdminApi, SuperAdminUploader, postsApi } from "@/lib/api";
import { ApiPost } from "@/lib/api-client";
import { env } from "@/lib/env";
import { SuperAdminAuthModal } from "@/components/SuperAdminAuthModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [uploaders, setUploaders] = useState<SuperAdminUploader[]>([]);
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsPage, setPostsPage] = useState(0);
  const [postsTake] = useState(10);

  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);

  const loadUploaders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await superAdminApi.listUploaders();
      setUploaders(res.items);
    } catch (e) {
      setError((e as Error).message);
      if ((e as Error).message.includes("unauthorized")) {
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      setPostsLoading(true);
      const res = await postsApi.list(postsTake, postsPage * postsTake);
      setPosts(res.items);
    } catch (e) {
      toast.error("Failed to load posts: " + (e as Error).message);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadUploaders();
    }
  }, [isAuthenticated]);

  const onAuthSuccess = (key: string) => {
    superAdminApi.setAdminKey(key);
    setIsAuthenticated(true);
  };

  const onAddUploader = async () => {
    if (!email.trim()) return;
    try {
      setError(null);
      const result = await superAdminApi.addUploader(email.trim());
      setEmail("");
      if (result.apiKey) {
        setNewApiKey(result.apiKey);
        toast.success("Uploader added successfully");
      }
      await loadUploaders();
    } catch (e) {
      setError((e as Error).message);
      toast.error("Failed to add uploader");
    }
  };

  const onRegenerateKey = async (uploaderId: string) => {
    try {
      setError(null);
      const res = await superAdminApi.createApiKey(uploaderId);
      setNewApiKey(res.apiKey);
      toast.success("API Key regenerated");
      await loadUploaders();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onDeletePost = async () => {
    if (!deletePostId) return;
    try {
      await postsApi.delete(deletePostId);
      toast.success("Post deleted successfully");
      loadPosts();
    } catch (e) {
      toast.error("Failed to delete post: " + (e as Error).message);
    } finally {
      setDeletePostId(null);
    }
  };

  if (!isAuthenticated) {
    return <SuperAdminAuthModal onSuccess={onAuthSuccess} />;
  }

  return (
    <div className="h-screen overflow-y-auto bg-[#060608] text-white selection:bg-white/10 custom-scrollbar">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Back to feed
            </button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-white to-white/40 bg-clip-text text-transparent">
              Super Admin Control
            </h1>
          </div>
          <div className="flex gap-3">
            {/* Header badges or stats could go here */}
          </div>
        </div>

        {newApiKey && (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-100">
                  API Key Generated
                </h3>
                <p className="text-sm opacity-70">
                  Make sure to copy this key now. It will not be shown again.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <code className="flex-1 bg-black/60 p-3 rounded-xl border border-white/10 font-mono text-sm break-all select-all flex items-center">
                {newApiKey}
              </code>
              <Button
                onClick={() => setNewApiKey(null)}
                variant="outline"
                className="bg-emerald-500 hover:bg-emerald-600 text-black border-none font-bold"
              >
                Done
              </Button>
            </div>
          </div>
        )}

        <Tabs defaultValue="uploaders" className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl h-auto">
            <TabsTrigger
              value="uploaders"
              className="rounded-lg px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-black transition-all"
            >
              <Users className="w-4 h-4 mr-2" />
              Uploaders
            </TabsTrigger>
            <TabsTrigger
              value="posts"
              className="rounded-lg px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-black transition-all"
              onClick={loadPosts}
            >
              <Film className="w-4 h-4 mr-2" />
              Content Management
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="uploaders"
            className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <div className="glass-morphism rounded-3xl p-6 border border-white/10 space-y-6 bg-white/[0.02]">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold">Add New Uploader</h2>
                    <p className="text-sm text-white/50">
                      Authorize a new account to upload content.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs text-white/40 uppercase font-black tracking-widest pl-1">
                        Email Address
                      </label>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="uploader@example.com"
                        className="w-full rounded-2xl bg-white/5 border border-white/10 px-5 py-4 focus:ring-2 focus:ring-white/20 transition-all outline-none"
                      />
                    </div>
                    <Button
                      onClick={onAddUploader}
                      disabled={!email.trim() || loading}
                      className="w-full h-14 rounded-2xl bg-white text-black font-bold hover:scale-[0.98] active:scale-100 transition-all shadow-2xl shadow-white/10"
                    >
                      {loading ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        "Authorize Account"
                      )}
                    </Button>
                  </div>

                  {error && (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-3 items-center">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="glass-morphism rounded-3xl border border-white/10 overflow-hidden bg-white/[0.01]">
                  <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold leading-none">
                        Registered Uploaders
                      </h2>
                      <p className="text-sm text-white/40 mt-1">
                        {uploaders.length} accounts verified
                      </p>
                    </div>
                    <button
                      onClick={loadUploaders}
                      className={`p-3 hover:bg-white/10 rounded-2xl transition-all ${loading ? "animate-spin" : ""}`}
                    >
                      <RefreshCw className="w-5 h-5 text-white/40" />
                    </button>
                  </div>
                  <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {uploaders.map((uploader) => (
                      <div
                        key={uploader.id}
                        className="px-8 py-6 flex items-center justify-between group hover:bg-white/[0.03] transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center font-bold text-white/20 border border-white/5">
                            {uploader.email[0].toUpperCase()}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-lg">
                                {uploader.email}
                              </span>
                              {!uploader.isActive && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 uppercase font-black tracking-tighter border border-red-500/20">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-white/30 truncate max-w-[200px]">
                              ID: {uploader.id}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => onRegenerateKey(uploader.id)}
                          variant="ghost"
                          className="rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all gap-2 h-10 px-4"
                        >
                          <Key className="w-4 h-4" />
                          <span className="hidden sm:inline">Regenerate</span>
                        </Button>
                      </div>
                    ))}
                    {uploaders.length === 0 && !loading && (
                      <div className="p-20 text-center space-y-4">
                        <Users className="w-12 h-12 text-white/10 mx-auto" />
                        <p className="text-white/20 font-medium text-lg">
                          No uploader accounts found in the database.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="posts"
            className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            <div className="glass-morphism rounded-3xl border border-white/10 overflow-hidden bg-white/[0.01]">
              <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold leading-none">
                    Stream Management
                  </h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                      disabled={postsPage === 0}
                      onClick={() => {
                        setPostsPage((p) => Math.max(0, p - 1));
                        setTimeout(loadPosts, 0);
                      }}
                      className="px-3 py-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all text-xs font-bold"
                    >
                      Prev
                    </button>
                    <span className="text-xs px-2 text-white/40">
                      Page {postsPage + 1}
                    </span>
                    <button
                      onClick={() => {
                        setPostsPage((p) => p + 1);
                        setTimeout(loadPosts, 0);
                      }}
                      className="px-3 py-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-all text-xs font-bold"
                    >
                      Next
                    </button>
                  </div>
                  <button
                    onClick={loadPosts}
                    className={`p-3 hover:bg-white/10 rounded-2xl transition-all ${postsLoading ? "animate-spin" : ""}`}
                  >
                    <RefreshCw className="w-5 h-5 text-white/40" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/5">
                      <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-white/40">
                        Preview
                      </th>
                      <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-white/40">
                        Content Details
                      </th>
                      <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-white/40">
                        Author
                      </th>
                      <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-white/40">
                        Stats
                      </th>
                      <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-white/40 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {posts.map((post) => (
                      <tr
                        key={post.id}
                        className="group hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-8 py-4">
                          <div className="w-16 h-20 rounded-xl bg-white/5 overflow-hidden border border-white/10">
                            {post.media?.[0] && (
                              <img
                                src={`${import.meta.env.VITE_STREAMLANDER_BASE_URL}/media/${post.media[0].id}?thumb=true`}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                alt=""
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <div className="space-y-1">
                            <p className="font-semibold line-clamp-1 group-hover:text-white transition-colors">
                              {post.caption || "No caption"}
                            </p>
                            <p className="text-xs text-white/30 truncate max-w-[200px]">
                              {post.description || "No description"}
                            </p>
                            <p className="text-[10px] text-white/20 font-mono mt-1">
                              {post.id}
                            </p>
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold">
                              {post.author.username?.[0] ||
                                post.author.userId[0]}
                            </div>
                            <span className="text-sm font-medium text-white/60">
                              {post.author.username || "Anonymous"}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex gap-4 text-xs text-white/40 font-bold">
                            <span className="flex items-center gap-1.5">
                              <Film className="w-3 h-3" />{" "}
                              {post.stats?.likes || 0}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <AlertCircle className="w-3 h-3 rotate-180" />{" "}
                              {post.stats?.comments || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <Button
                            onClick={() => setDeletePostId(post.id)}
                            variant="destructive"
                            size="icon"
                            className="rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {posts.length === 0 && !postsLoading && (
                <div className="p-32 text-center space-y-4">
                  <Film className="w-16 h-16 text-white/10 mx-auto" />
                  <p className="text-white/30 font-medium text-lg italic">
                    No content found in the archives.
                  </p>
                </div>
              )}

              {postsLoading && (
                <div className="p-20 flex justify-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-white/20" />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={!!deletePostId}
        onOpenChange={() => setDeletePostId(null)}
      >
        <AlertDialogContent className="bg-[#0c0c0e] border-white/10 rounded-3xl p-8 backdrop-blur-xl">
          <AlertDialogHeader className="space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-2">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold text-center">
              Terminate Post?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/50 text-center text-lg leading-relaxed">
              This action is permanent. The content will be purged from the
              database and the media processor. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 sm:justify-center gap-4">
            <AlertDialogCancel className="bg-white/5 border-white/10 rounded-2xl px-8 h-12 hover:bg-white/10 hover:text-white transition-all">
              Abort
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeletePost}
              className="bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl px-10 h-12 shadow-2xl shadow-red-500/20 transition-all"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
