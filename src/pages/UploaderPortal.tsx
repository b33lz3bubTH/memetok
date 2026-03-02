import { useMemo, useState } from 'react';
import { SignInButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CreatePostButton from '@/components/CreatePostButton';

export default function UploaderPortal() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const canProceed = useMemo(() => apiKey.trim().length > 0, [apiKey]);

  return (
    <div className="min-h-screen bg-background text-white p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/70 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Back to feed
        </button>

        <div className="glass rounded-2xl p-6 space-y-5">
          <h1 className="text-xl font-semibold">Uploader portal</h1>
          <p className="text-sm text-white/70">This route is locked. Enter the upload API key to continue.</p>

          <div className="space-y-3">
            <label className="text-sm text-white/80">Upload API key</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-white/60 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full rounded-md bg-black/30 border border-white/20 pl-9 pr-3 py-2"
                placeholder="Enter uploader API key"
              />
            </div>
          </div>

          {!canProceed ? (
            <div className="text-xs text-white/60">Provide an API key to unlock uploader actions.</div>
          ) : (
            <>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20">Sign in to continue</button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <CreatePostButton uploaderApiKey={apiKey.trim()} />
              </SignedIn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
