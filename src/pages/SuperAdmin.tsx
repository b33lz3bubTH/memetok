import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Trash2, Key } from "lucide-react";
import { superAdminApi, SuperAdminUploader } from "@/lib/api";
import { apiClient } from "@/lib/api-client";
import { SuperAdminAuthModal } from "@/components/SuperAdminAuthModal";

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [uploaders, setUploaders] = useState<SuperAdminUploader[]>([]);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await superAdminApi.listUploaders();
      setUploaders(res.items);
    } catch (e) {
      setError((e as Error).message);
      // If unauthorized, clear auth
      if ((e as Error).message.includes("unauthorized")) {
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Intentionally not restoring from sessionStorage for security.
    // The user must authenticate per explicit tab load.
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
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
      }
      await loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onRegenerateKey = async (uploaderId: string) => {
    try {
      setError(null);
      const res = await superAdminApi.createApiKey(uploaderId);
      setNewApiKey(res.apiKey);
      await loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!isAuthenticated) {
    return <SuperAdminAuthModal onSuccess={onAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to feed
          </button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
            Super Admin
          </h1>
        </div>

        {newApiKey && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-2 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-2 font-medium">
              <Key className="w-4 h-4" />
              New API Key Generated
            </div>
            <p className="text-sm opacity-80">
              Copy this key now. It won't be shown again.
            </p>
            <div className="flex gap-2">
              <code className="flex-1 bg-black/40 p-2 rounded border border-white/10 select-all">
                {newApiKey}
              </code>
              <button
                onClick={() => setNewApiKey(null)}
                className="px-3 py-1 rounded bg-emerald-500 text-black text-sm font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <div className="glass rounded-2xl p-6 border border-white/5 space-y-4">
              <h2 className="font-semibold text-white/90">Add Uploader</h2>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-white/40 uppercase font-bold tracking-wider">
                    Email Address
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="uploader@example.com"
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 focus:border-white/20 transition-colors outline-none"
                  />
                </div>
                <button
                  onClick={onAddUploader}
                  disabled={!email.trim()}
                  className="w-full py-2.5 rounded-lg bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-50 transition-all shadow-xl shadow-white/5"
                >
                  Add Account
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <h2 className="font-semibold">
                  Uploader Accounts ({uploaders.length})
                </h2>
                <button
                  onClick={loadData}
                  className={`p-2 hover:bg-white/5 rounded-lg transition-colors ${loading ? "animate-spin" : ""}`}
                >
                  <RefreshCw className="w-4 h-4 text-white/40" />
                </button>
              </div>
              <div className="divide-y divide-white/5">
                {uploaders.map((uploader) => (
                  <div
                    key={uploader.id}
                    className="px-6 py-4 flex items-center justify-between group hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{uploader.email}</span>
                        {!uploader.isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 uppercase font-bold">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/30 flex items-center gap-2">
                        {/* Status is shown in the name line */}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => onRegenerateKey(uploader.id)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 text-xs font-bold text-white/40 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 border border-white/5 active:scale-95"
                      >
                        <Key className="w-3.5 h-3.5" />
                        Regenerate Key
                      </button>
                    </div>
                  </div>
                ))}
                {uploaders.length === 0 && !loading && (
                  <div className="p-12 text-center text-white/20 italic">
                    No uploader accounts found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
