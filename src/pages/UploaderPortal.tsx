import { useState } from 'react';
import { SignInButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CreatePostButton from '@/components/CreatePostButton';

export default function UploaderPortal() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');

  return (
    <div className="min-h-screen bg-background text-white p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/70 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Back to feed
        </button>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h1 className="text-xl font-semibold">Uploader portal</h1>
          <p className="text-sm text-white/70">Only the single uploader with the API key can publish posts.</p>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20">Sign in to continue</button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <div className="space-y-3">
              <label className="text-sm text-white/80">Uploader API key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full rounded-md bg-black/30 border border-white/20 px-3 py-2"
                placeholder="Enter uploader API key"
              />
              <div>{apiKey ? <CreatePostButton uploaderApiKey={apiKey} /> : <div className="text-xs text-white/60">Provide API key to upload.</div>}</div>
            </div>
          </SignedIn>
        </div>
      </div>
    </div>
  );
}
