import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Loader2, Upload, X } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { fetchFeed } from '@/store/slices/feedSlice';
import { media, postsApi, type MediaType } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';

type StepKey = 'upload' | 'preview' | 'details' | 'publish';

const STEP_ORDER: Array<{ key: StepKey; title: string; subtitle: string }> = [
  { key: 'upload', title: 'Upload', subtitle: 'Pick video or images' },
  { key: 'preview', title: 'Preview', subtitle: 'Check what you selected' },
  { key: 'details', title: 'Details', subtitle: 'Title + tags' },
  { key: 'publish', title: 'Publish', subtitle: 'Final preview + upload' },
];

function isVideoFile(f: File) {
  const name = f.name.toLowerCase();
  return f.type === 'video/mp4' || name.endsWith('.mp4');
}

function isImageFile(f: File) {
  return f.type.startsWith('image/');
}

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export default function CreatePostModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dispatch = useAppDispatch();
  const { getToken } = useAuth();
  const { user } = useUser();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [stepIdx, setStepIdx] = useState(0);
  const step = STEP_ORDER[stepIdx]?.key ?? 'upload';

  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [overallPct, setOverallPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState(0);

  const tags = useMemo(() => parseTags(tagsRaw), [tagsRaw]);
  const hasVideo = useMemo(() => files.some(isVideoFile), [files]);
  const mediaType: MediaType | null = useMemo(() => {
    if (files.length === 0) return null;
    if (hasVideo) return 'video';
    return 'image';
  }, [files.length, hasVideo]);

  const previews = useMemo(() => {
    return files.map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
      kind: isVideoFile(f) ? 'video' : 'image',
    }));
  }, [files]);

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  const reset = () => {
    setStepIdx(0);
    setFiles([]);
    setTitle('');
    setDescription('');
    setTagsRaw('');
    setIsUploading(false);
    setOverallPct(0);
    setError(null);
    setDoneCount(0);
    abortRef.current?.abort();
    abortRef.current = null;
  };

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isUploadStepValid = files.length > 0 && !!mediaType && (hasVideo ? files.length === 1 : true);
  const isDetailsStepValid = title.trim().length > 0;

  const getMaxAllowedStepIdx = () => {
    if (!isUploadStepValid) return 0;
    if (!isDetailsStepValid) return 2;
    return STEP_ORDER.length - 1;
  };

  const canGoNext =
    (step === 'upload' && isUploadStepValid) ||
    (step === 'preview' && isUploadStepValid) ||
    (step === 'details' && isUploadStepValid && isDetailsStepValid);

  const goNext = () => {
    if (!canGoNext) return;
    setStepIdx((i) => Math.min(i + 1, getMaxAllowedStepIdx()));
  };

  const goBack = () => setStepIdx((i) => Math.max(i - 1, 0));

  const validateSelection = (picked: File[]) => {
    if (picked.length === 0) return { ok: false, reason: 'No file selected.' };
    
    const videos = picked.filter(isVideoFile);
    const images = picked.filter(isImageFile);
    
    if (videos.length > 1) return { ok: false, reason: 'Only one video is allowed per post.' };
    if (videos.length > 0 && images.length > 0) return { ok: false, reason: 'Cannot mix videos and images in one post.' };
    
    for (const file of picked) {
      const isVideo = isVideoFile(file);
      const isImage = isImageFile(file);
      if (!isVideo && !isImage) {
        return { ok: false, reason: `File ${file.name} is not a valid image or MP4 video.` };
      }
    }
    
    return { ok: true as const };
  };

  const pickFiles = (picked: File[]) => {
    const v = validateSelection(picked);
    if (!v.ok) {
      toast({ title: 'Invalid selection', description: v.reason });
      return;
    }
    setFiles(picked);
    setError(null);
    setDoneCount(0);
  };

  const startUpload = async () => {
    if (files.length === 0 || !mediaType) return;
    const token = await getToken();
    if (!token) {
      toast({ title: 'Sign in required', description: 'You need to login to post.' });
      return;
    }

    setIsUploading(true);
    setError(null);
    setDoneCount(0);
    setOverallPct(0);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      await media.uploadWithProgress(
        files,
        {
          signal: abort.signal,
          onProgress: (pct) => {
            setOverallPct(pct);
          },
        },
        {
          caption: title.trim(),
          description: description.trim(),
          tags,
          username: user?.fullName || user?.username || undefined,
          profilePhoto: user?.imageUrl || undefined,
        },
        token
      );

      await dispatch(fetchFeed());
      toast({ title: 'Posted', description: 'Your post is live' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      setError(msg);
      toast({ title: 'Upload failed', description: msg });
      return;
    } finally {
      setIsUploading(false);
      abortRef.current = null;
    }

    onOpenChange(false);
  };

  const cancelUpload = () => {
    abortRef.current?.abort();
  };

    const renderPreview = () => {
    if (previews.length === 0) return null;
    if (previews.length === 1) {
      const p = previews[0]!;
      return p.kind === 'video' ? (
        <video src={p.url} controls className="w-full rounded-lg max-h-[420px] bg-black" />
      ) : (
        <img src={p.url} className="w-full rounded-lg max-h-[420px] object-contain bg-black" alt="preview" />
      );
    }

    return (
      <div className="px-4 sm:px-10 flex items-center justify-center">
        <Carousel opts={{ loop: true }} className="w-full">
          <CarouselContent className="-ml-0">
            {previews.map((p) => (
              <CarouselItem key={p.url} className="pl-0 basis-full">
                <div className="w-full flex items-center justify-center h-full">
                  <img
                    src={p.url}
                    className="w-full rounded-lg max-h-[420px] object-contain bg-black"
                    alt={p.file.name}
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground truncate text-center">{p.file.name}</div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden sm:flex" />
          <CarouselNext className="hidden sm:flex" />
        </Carousel>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!isUploading ? onOpenChange(o) : undefined)}>
      <DialogContent className="p-0 overflow-hidden max-w-full sm:max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] flex-1 min-h-0">
          {/* Steps */}
          <div className="border-b lg:border-b-0 lg:border-r bg-muted/30 p-4">
            <div className="text-xs font-medium text-muted-foreground mb-3">Create post</div>
            <div className="space-y-2">
              {STEP_ORDER.map((s, idx) => {
                const active = idx === stepIdx;
                const done = idx < stepIdx;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => (!isUploading ? setStepIdx(idx) : undefined)}
                    className={[
                      'w-full text-left rounded-lg px-3 py-2 transition',
                      active ? 'bg-background shadow-sm' : 'hover:bg-background/60',
                    ].join(' ')}
                    disabled={isUploading}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={[
                          'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold',
                          done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                        ].join(' ')}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold leading-5 truncate">{s.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{s.subtitle}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto">
            <DialogHeader className="mb-4">
              <DialogTitle>{STEP_ORDER[stepIdx]?.title}</DialogTitle>
            </DialogHeader>

            {step === 'upload' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-dashed p-6 bg-background">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                    <div className="text-sm font-semibold">Upload media</div>
                      <div className="text-xs text-muted-foreground">
                        {hasVideo ? '1 video only (MP4).' : 'Multiple images allowed.'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Choose files
                      </Button>
                      {files.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => pickFiles([])}
                          disabled={isUploading}
                          className="gap-2"
                        >
                          <X className="h-4 w-4" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? []);
                      pickFiles(picked);
                      e.target.value = '';
                    }}
                  />

                  {files.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="secondary">{hasVideo ? 'Video' : 'Image'}</Badge>
                      {files.map((f) => (
                        <Badge key={f.name} variant="outline" className="max-w-[220px] truncate">
                          {f.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {renderPreview()}
              </div>
            )}

            {step === 'preview' && <div className="space-y-4">{renderPreview()}</div>}

            {step === 'details' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="post-title">Title</Label>
                  <Input
                    id="post-title"
                    value={title}
                    maxLength={300}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give it a title..."
                    disabled={isUploading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-description">Description (optional)</Label>
                  <textarea
                    id="post-description"
                    value={description}
                    maxLength={1000}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a description..."
                    disabled={isUploading}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-tags">Tags (comma separated)</Label>
                  <Input
                    id="post-tags"
                    value={tagsRaw}
                    onChange={(e) => setTagsRaw(e.target.value)}
                    placeholder="meme, cats, chill"
                    disabled={isUploading}
                  />
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {tags.slice(0, 12).map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                      {tags.length > 12 && <Badge variant="secondary">+{tags.length - 12}</Badge>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 'publish' && (
              <div className="space-y-4">
                {renderPreview()}

                <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Final check</div>
                    <Badge variant="outline">{files.length} item{files.length === 1 ? '' : 's'}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{title ? title : 'No title'}</div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tags.slice(0, 8).map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                      {tags.length > 8 && <Badge variant="secondary">+{tags.length - 8}</Badge>}
                    </div>
                  )}
                </div>

                {(isUploading || doneCount > 0) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {isUploading ? 'Uploading…' : 'Done'}
                      </span>
                      <span>{Math.round(overallPct)}%</span>
                    </div>
                    <Progress value={overallPct} />
                    <div className="text-xs text-muted-foreground">
                      {doneCount}/{files.length} complete
                    </div>
                  </div>
                )}

                {error && <div className="text-sm text-destructive">{error}</div>}
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={goBack} disabled={stepIdx === 0 || isUploading}>
                Back
              </Button>

              <div className="flex items-center gap-2">
                {isUploading && (
                  <Button type="button" variant="outline" onClick={cancelUpload}>
                    Cancel upload
                  </Button>
                )}

                {step !== 'publish' ? (
                  <Button type="button" onClick={goNext} disabled={!canGoNext || isUploading}>
                    Next
                  </Button>
                ) : (
                  <Button type="button" onClick={startUpload} disabled={files.length === 0 || isUploading}>
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading
                      </>
                    ) : (
                      'Publish'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

