import { useCallback, useRef, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { SignInButton, SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { media, postsApi } from '@/lib/api';

export default function CreatePostButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { getToken } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const handlePick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const up = await media.upload(file);
        const caption = window.prompt('Caption?') ?? '';
        const tagsRaw = window.prompt('Tags? (comma separated)') ?? '';
        const tags = tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);

        const token = await getToken();
        if (!token) return;
        await postsApi.create(
          { mediaId: up.id, mediaType: file.type.startsWith('image/') ? 'image' : 'video', caption, tags },
          token
        );
      } finally {
        setIsUploading(false);
      }
    },
    [getToken]
  );

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />

      <SignedOut>
        <SignInButton mode="modal">
          <button className="glass w-14 h-14 rounded-full flex items-center justify-center">
            <Plus className="w-7 h-7 text-white" />
          </button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <button
          onClick={handlePick}
          disabled={isUploading}
          className="glass w-14 h-14 rounded-full flex items-center justify-center disabled:opacity-60"
        >
          {isUploading ? <Loader2 className="w-7 h-7 text-white animate-spin" /> : <Plus className="w-7 h-7 text-white" />}
        </button>
      </SignedIn>
    </div>
  );
}

