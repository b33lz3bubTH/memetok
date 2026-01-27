import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

const ShareModal = ({ open, onOpenChange, postId }: ShareModalProps) => {
  const [copied, setCopied] = useState(false);
  const postUrl = `${window.location.origin}/post/${postId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={postUrl}
              readOnly
              className="flex-1 font-mono text-sm"
            />
            <Button
              onClick={handleCopy}
              size="icon"
              variant={copied ? 'default' : 'outline'}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          {copied && (
            <p className="text-sm text-muted-foreground text-center">
              Link copied to clipboard!
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareModal;
