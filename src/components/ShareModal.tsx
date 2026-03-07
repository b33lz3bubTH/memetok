import { useState } from 'react';
import { Copy, Check, Twitter, Facebook, MessageCircle, Send, Linkedin, Link as LinkIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

const SOCIAL_PLATFORMS = [
  { name: 'WhatsApp', icon: MessageCircle, color: 'bg-[#25D366]', hover: 'hover:bg-[#20ba5a]' },
  { name: 'Facebook', icon: Facebook, color: 'bg-[#1877F2]', hover: 'hover:bg-[#166fe5]' },
  { name: 'Twitter', icon: Twitter, color: 'bg-[#1DA1F2]', hover: 'hover:bg-[#1a91da]' },
  { name: 'Messenger', icon: Send, color: 'bg-[#0084FF]', hover: 'hover:bg-[#0076e4]' },
  { name: 'LinkedIn', icon: Linkedin, color: 'bg-[#0A66C2]', hover: 'hover:bg-[#0958a8]' },
];

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

  const handleShare = (platform: string) => {
    let url = '';
    const text = "Check out this awesome post on MemeTok!";
    
    switch (platform) {
      case 'WhatsApp':
        url = `https://wa.me/?text=${encodeURIComponent(text + ' ' + postUrl)}`;
        break;
      case 'Facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`;
        break;
      case 'Twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(postUrl)}`;
        break;
      case 'LinkedIn':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`;
        break;
    }
    
    if (url) window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-white/10 text-white rounded-3xl overflow-hidden p-0 gap-0">
        <DialogHeader className="p-6 pb-2 border-b border-white/5">
          <DialogTitle className="text-xl font-bold text-center">Share to</DialogTitle>
        </DialogHeader>
        
        <div className="p-6 pb-8">
          {/* Social Icons Grid */}
          <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-none snap-x h-24">
            {SOCIAL_PLATFORMS.map((platform) => (
              <button
                key={platform.name}
                onClick={() => handleShare(platform.name)}
                className="flex flex-col items-center gap-2 flex-shrink-0 snap-start group"
              >
                <div className={`w-14 h-14 ${platform.color} ${platform.hover} rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-active:scale-95 shadow-lg`}>
                  <platform.icon className="w-7 h-7 text-white" />
                </div>
                <span className="text-[11px] font-medium text-white/60 group-hover:text-white transition-colors">
                  {platform.name}
                </span>
              </button>
            ))}
          </div>

          <div className="h-px bg-white/5 w-full mb-6" />

          {/* Copy Link Section */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-white/40 uppercase tracking-widest pl-1">Copy Link</span>
            <div className="bg-white/5 rounded-2xl flex items-center p-1.5 border border-white/10 group focus-within:border-primary/50 transition-all">
              <div className="pl-3 pr-2 text-white/30">
                <LinkIcon className="w-4 h-4" />
              </div>
              <input
                value={postUrl}
                readOnly
                className="bg-transparent flex-1 text-sm text-white/80 outline-none truncate pr-2 font-mono"
              />
              <Button
                onClick={handleCopy}
                className={`rounded-xl h-10 px-5 font-bold text-xs transition-all duration-300 ${
                  copied 
                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                  : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                <div className="relative flex items-center justify-center min-w-[60px]">
                  {copied ? (
                    <div className="flex items-center gap-1.5 animate-in zoom-in duration-200">
                      <Check className="w-3.5 h-3.5 stroke-[3px]" />
                      Copied
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 animate-in zoom-in duration-200">
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </div>
                  )}
                </div>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareModal;
