import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SignInButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import CreatePostModal from '@/components/CreatePostModal';

export default function CreatePostButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <SignedOut>
        <SignInButton mode="modal">
          <button className="glass w-14 h-14 rounded-full flex items-center justify-center">
            <Plus className="w-7 h-7 text-white" />
          </button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <button
          onClick={() => setOpen(true)}
          className="glass w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-60"
        >
          <Plus className="w-7 h-7 text-white" />
        </button>
        <CreatePostModal open={open} onOpenChange={setOpen} />
      </SignedIn>
    </div>
  );
}

