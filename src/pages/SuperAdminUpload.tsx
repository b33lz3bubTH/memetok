import { useState, useEffect } from 'react';
import { ArrowLeft, ShieldCheck, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { superAdminApi } from '@/lib/api';
import CreatePostButton from '@/components/CreatePostButton';

export default function SuperAdminUpload() {
  const navigate = useNavigate();
  const [rootKey, setRootKey] = useState('');
  const [isKeyApplied, setIsKeyApplied] = useState(false);

  // Apply key to api client on change
  const handleApplyKey = () => {
    if (rootKey.trim()) {
      superAdminApi.setAdminKey(rootKey.trim());
      setIsKeyApplied(true);
    }
  };

  // Reset applied state if key changes
  useEffect(() => {
    setIsKeyApplied(false);
  }, [rootKey]);

  return (
    <div className="min-h-screen bg-background text-white p-6 pb-20 overflow-y-auto">
      <div className="max-w-xl mx-auto space-y-8">
        <button 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </button>

        <div className="glass rounded-3xl p-8 border border-white/5 shadow-2xl relative overflow-hidden">
          {/* Accent decoration */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-[100px] rounded-full" />
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Super Admin Portal</h1>
                <p className="text-sm text-white/40">Authorize with the Root Key to post as Root.</p>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/30 uppercase tracking-[1px] ml-1">
                  System Root Key
                </label>
                <div className="relative group">
                  <Key className="w-4 h-4 text-white/20 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" />
                  <input
                    type="password"
                    value={rootKey}
                    onChange={(e) => setRootKey(e.target.value)}
                    className="w-full rounded-2xl bg-white/[0.03] border border-white/10 pl-11 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-white/10"
                    placeholder="Enter system high-level root key"
                  />
                </div>
              </div>

              {!isKeyApplied ? (
                <button
                  onClick={handleApplyKey}
                  disabled={!rootKey.trim()}
                  className="w-full py-4 rounded-2xl bg-white text-black font-bold text-sm hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition-all shadow-xl"
                >
                  Verify Access
                </button>
              ) : (
                <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6 text-center space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="flex flex-col items-center gap-2">
                     <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-green-400" />
                     </div>
                     <span className="text-sm font-semibold text-green-400">Root Access Granted</span>
                  </div>
                  <div className="pt-2 border-t border-green-500/10 flex justify-center">
                    {/* Pass empty string as uploaderApiKey - CreatePostModal will fall back to X-Super-Admin-Key if uploaderApiKey is empty */}
                    <CreatePostButton uploaderApiKey="" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-center p-6 glass rounded-2xl border border-white/5 opacity-50">
           <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2">Security Notice</h3>
           <p className="text-[10px] text-white/30 leading-relaxed px-4">
             This portal bypasses standard uploader restrictions. All actions performed via Root Key are logged and associated with the system identity. This key is NOT stored on secondary storage.
           </p>
        </div>
      </div>
    </div>
  );
}
