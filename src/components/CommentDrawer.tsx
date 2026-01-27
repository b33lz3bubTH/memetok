import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeCommentDrawer } from '@/store/slices/uiSlice';
import { X, Heart, Send } from 'lucide-react';
import gsap from 'gsap';
import { postsApi, Comment } from '@/lib/api';
import { SignInButton, SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { incCommentsCount, fetchPostStats } from '@/store/slices/feedSlice';
import { cache } from '@/lib/cache';
import CreatePostButton from './CreatePostButton';

const CommentDrawer = () => {
  const dispatch = useAppDispatch();
  const { isCommentDrawerOpen, activeVideoId } = useAppSelector((state) => state.ui);
  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const { getToken } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const postId = useMemo(() => activeVideoId ?? '', [activeVideoId]);

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

  useEffect(() => {
    if (!isCommentDrawerOpen || !postId) return;
    setIsLoading(true);
    
    (async () => {
      dispatch(fetchPostStats(postId));
      
      let cachedComments = await cache.getComments(postId);
      if (cachedComments.length > 0) {
        setComments(cachedComments);
        setIsLoading(false);
      }
      
      try {
        const r = await postsApi.listComments(postId, 50, 0);
        setComments(r.items);
        await cache.saveComments(r.items);
      } catch (err) {
        console.error('Failed to fetch comments:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isCommentDrawerOpen, postId, dispatch]);

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

  const handleSend = useCallback(async () => {
    if (!postId) return;
    const v = text.trim();
    if (!v) return;
    const token = await getToken();
    if (!token) return;
    const c = await postsApi.addComment(postId, v, token);
    setComments((prev) => [c, ...prev]);
    await cache.saveComment(c);
    dispatch(incCommentsCount({ videoId: postId, delta: 1 }));
    setText('');
  }, [dispatch, getToken, postId, text]);

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
            {comments.length} Comments
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
          {isLoading && (
            <div className="text-sm text-white/60">Loading...</div>
          )}
          {!isLoading && comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-10 h-10 rounded-full flex-shrink-0 bg-white/10" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium text-sm">
                    {comment.userId.slice(-6)}
                  </span>
                </div>
                <p className="text-white/80 text-sm">{comment.text}</p>
                <div className="flex items-center gap-4 mt-2">
                  <button className="flex items-center gap-1 text-muted-foreground text-xs hover:text-primary transition-colors">
                    <Heart className="w-4 h-4" />
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
            <SignedOut>
              <SignInButton mode="modal">
                <button className="w-full bg-muted rounded-full px-4 py-3 text-sm text-white/70 text-left">
                  Sign in to comment
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add comment..."
                className="flex-1 bg-muted rounded-full px-4 py-3 text-sm text-white placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
              <button
                onClick={handleSend}
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <Send className="w-5 h-5 text-primary-foreground" />
              </button>
            </SignedIn>
          </div>
        </div>
      </div>

      {/* Floating Create Post Button */}
      {/* <div className="fixed bottom-24 right-4 md:bottom-24 md:right-8 z-50">
        <CreatePostButton floating />
      </div> */}
    </>
  );
};

export default CommentDrawer;
