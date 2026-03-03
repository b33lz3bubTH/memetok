import { useState } from "react";
import { Key, Shield } from "lucide-react";

interface SuperAdminAuthModalProps {
  onSuccess: (key: string) => void;
}

export function SuperAdminAuthModal({ onSuccess }: SuperAdminAuthModalProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      onSuccess(key.trim());
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md glass border border-white/10 rounded-2xl p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Super Admin Access</h2>
          <p className="text-sm text-white/50">
            Please enter your super admin API key to manage uploaders.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-white/40 uppercase font-bold tracking-wider">
              Admin API Key
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="password"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setError(false);
                }}
                placeholder="Enter your key..."
                className={`w-full rounded-xl bg-white/5 border ${
                  error ? "border-red-500/50" : "border-white/10"
                } pl-10 pr-4 py-3 focus:outline-none focus:border-white/20 transition-all text-white placeholder:text-white/20`}
                autoFocus
              />
            </div>
            {error && (
              <p className="text-xs text-red-400">
                Please enter a valid API key.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-white/90 transition-all shadow-xl shadow-white/5 active:scale-[0.98]"
          >
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
