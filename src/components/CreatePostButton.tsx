import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SignInButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import { useAppSelector } from '@/store/hooks';
import CreatePostModal from '@/components/CreatePostModal';

interface CreatePostButtonProps {
  floating?: boolean;
}

export default function CreatePostButton({ floating = false }: CreatePostButtonProps) {
  const [open, setOpen] = useState(false);
  const { isCommentDrawerOpen } = useAppSelector((state) => state.ui);
  
  if (floating) {
    return (
      <SignedIn>
        <button
          onClick={() => setOpen(true)}
          className="glass w-12 h-12 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>
        <CreatePostModal open={open} onOpenChange={setOpen} />
      </SignedIn>
    );
  }

  if (isCommentDrawerOpen) return null;

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

