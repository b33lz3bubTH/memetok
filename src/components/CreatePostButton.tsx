import { useState } from 'react';
import { Plus } from 'lucide-react';
import CreatePostModal from '@/components/CreatePostModal';

interface CreatePostButtonProps {
  uploaderApiKey: string;
}

export default function CreatePostButton({ uploaderApiKey }: CreatePostButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass px-4 py-2 rounded-full flex items-center gap-2 hover:opacity-90 transition-opacity"
      >
        <Plus className="w-5 h-5 text-white" />
        <span className="text-sm text-white">Upload post</span>
      </button>
      <CreatePostModal open={open} onOpenChange={setOpen} uploaderApiKey={uploaderApiKey} />
    </>
  );
}
