'use client';

import { useRef, useState } from 'react';
import { he } from '@/lib/he';
import { signCourseUpload, uploadToCloudinary } from '@/lib/client/upload';
import { Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import type { CourseMarketing } from '@/lib/validation/marketing';

type GalleryItem = CourseMarketing['gallery'][number];

/**
 * Owner gallery manager: photos, short clips, and before/after pairs.
 * Uploads go straight to the tenant's course folder on Cloudinary.
 */
export default function GalleryEditor({
  courseId,
  items,
  onChange,
}: {
  courseId: string;
  items: GalleryItem[];
  onChange: (items: GalleryItem[]) => void;
}) {
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const beforeInput = useRef<HTMLInputElement>(null);
  const afterInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingBefore, setPendingBefore] = useState<string | null>(null);

  const full = items.length >= 8;

  async function upload(file: File, kind: 'image' | 'video'): Promise<string | null> {
    setError(null);
    const signed = await signCourseUpload(courseId, kind);
    if ('error' in signed) {
      setError(signed.error === 'not_configured' ? he.cloudinaryMissing : he.uploadFailed);
      return null;
    }
    setProgress(0);
    try {
      const result = await uploadToCloudinary(file, signed.sign, setProgress);
      return result.public_id;
    } catch {
      setError(he.uploadFailed);
      return null;
    } finally {
      setProgress(null);
    }
  }

  async function addImage(file: File) {
    const publicId = await upload(file, 'image');
    if (publicId) onChange([...items, { publicId, kind: 'IMAGE', afterPublicId: '', caption: '' }]);
  }

  async function addVideo(file: File) {
    const publicId = await upload(file, 'video');
    if (publicId) onChange([...items, { publicId, kind: 'VIDEO', afterPublicId: '', caption: '' }]);
  }

  async function addBefore(file: File) {
    const publicId = await upload(file, 'image');
    // Browsers only open file pickers on a direct user click, so the "after"
    // image is chosen via an explicit button rendered below.
    if (publicId) setPendingBefore(publicId);
  }

  async function addAfter(file: File) {
    if (!pendingBefore) return;
    const publicId = await upload(file, 'image');
    if (publicId) {
      onChange([
        ...items,
        { publicId: pendingBefore, kind: 'BEFORE_AFTER', afterPublicId: publicId, caption: '' },
      ]);
    }
    setPendingBefore(null);
  }

  const kindLabel = (item: GalleryItem) =>
    item.kind === 'VIDEO' ? '🎬' : item.kind === 'BEFORE_AFTER' ? '⇄' : '🖼️';

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">{he.galleryHint}</p>

      <div className="flex flex-wrap gap-2">
        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) addImage(f);
          }}
        />
        <input
          ref={videoInput}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) addVideo(f);
          }}
        />
        <input
          ref={beforeInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) addBefore(f);
          }}
        />
        <input
          ref={afterInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) addAfter(f);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={progress !== null || full}
          onClick={() => imageInput.current?.click()}
        >
          🖼️ {he.addPhoto}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={progress !== null || full}
          onClick={() => videoInput.current?.click()}
        >
          🎬 {he.addVideo}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={progress !== null || full || pendingBefore !== null}
          onClick={() => beforeInput.current?.click()}
          title={he.beforeAfterHint}
        >
          ⇄ {he.addBeforeAfter}
        </Button>
      </div>

      {pendingBefore && (
        <div className="flex flex-wrap items-center gap-3 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-brand-900">
            {he.galleryBeforeDone}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={progress !== null}
            onClick={() => afterInput.current?.click()}
          >
            {he.galleryPickAfter}
          </Button>
          <button
            type="button"
            className="text-xs font-medium text-muted hover:text-danger transition-colors"
            onClick={() => setPendingBefore(null)}
          >
            {he.cancel}
          </button>
        </div>
      )}

      {progress !== null && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-ink/[0.07] rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted tabular-nums">
            {he.uploading} {progress}%
          </span>
        </div>
      )}
      {error && <p className="text-sm text-danger font-medium">{error}</p>}

      {items.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item, i) => (
            <li key={i} className="border border-line rounded-xl p-3 bg-paper/50 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span aria-hidden>{kindLabel(item)}</span>
                <span className="text-muted text-xs truncate flex-1" dir="ltr">
                  {item.publicId.split('/').pop()}
                  {item.kind === 'BEFORE_AFTER' && ` ⇄ ${item.afterPublicId.split('/').pop()}`}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  className="text-xs font-medium text-muted hover:text-danger transition-colors"
                >
                  {he.removeItem}
                </button>
              </div>
              <Input
                value={item.caption}
                placeholder={he.galleryCaption}
                onChange={(e) =>
                  onChange(items.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
