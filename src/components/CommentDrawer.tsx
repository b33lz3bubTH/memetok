import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeCommentDrawer } from '@/store/slices/uiSlice';
import { MOCK_COMMENTS } from '@/config/appConfig';
import { X, Heart, Send } from 'lucide-react';
import gsap from 'gsap';

const CommentDrawer = () => {
  const dispatch = useAppDispatch();
  const { isCommentDrawerOpen } = useAppSelector((state) => state.ui);
  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCommentDrawerOpen) {
      // Animate in
      if (backdropRef.current) {
        gsap.fromTo(
          backdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.3, ease: 'power2.out' }
        );
      }
      if (drawerRef.current) {
        gsap.fromTo(
          drawerRef.current,
          { y: '100%' },
          { y: '0%', duration: 0.4, ease: 'power3.out' }
        );
      }
    }
  }, [isCommentDrawerOpen]);

  const handleClose = useCallback(() => {
    // Animate out
    if (backdropRef.current) {
      gsap.to(backdropRef.current, {
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
      });
    }
    if (drawerRef.current) {
      gsap.to(drawerRef.current, {
        y: '100%',
        duration: 0.3,
        ease: 'power3.in',
        onComplete: () => {
          dispatch(closeCommentDrawer());
        },
      });
    }
  }, [dispatch]);

  if (!isCommentDrawerOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/60 z-40"
        onClick={handleClose}
      />

      {/* Drawer */}
      <div ref={drawerRef} className="comment-drawer">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-white font-bold text-lg">
            {MOCK_COMMENTS.length} Comments
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(70vh-140px)]">
          {MOCK_COMMENTS.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <img
                src={comment.avatar}
                alt={comment.username}
                className="w-10 h-10 rounded-full flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium text-sm">
                    {comment.username}
                  </span>
                </div>
                <p className="text-white/80 text-sm">{comment.text}</p>
                <div className="flex items-center gap-4 mt-2">
                  <button className="flex items-center gap-1 text-muted-foreground text-xs hover:text-primary transition-colors">
                    <Heart className="w-4 h-4" />
                    {comment.likes}
                  </button>
                  <button className="text-muted-foreground text-xs hover:text-primary transition-colors">
                    Reply
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Add comment..."
              className="flex-1 bg-muted rounded-full px-4 py-3 text-sm text-white placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
            <button className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-opacity">
              <Send className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CommentDrawer;
