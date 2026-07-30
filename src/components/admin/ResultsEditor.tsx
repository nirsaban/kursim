'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { signCourseUpload, uploadToCloudinary } from '@/lib/client/upload';
import { Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import type { CourseMarketing } from '@/lib/validation/marketing';

type ResultItem = CourseMarketing['results'][number];

const MAX = 12;

/**
 * Owner editor for the results wall. Takes a multi-file pick and uploads the
 * batch one at a time — Cloudinary signatures are minted per upload, and a
 * serial queue keeps the progress bar meaningful.
 */
export default function ResultsEditor({
  courseId,
  items,
  onChange,
}: {
  courseId: string;
  items: ResultItem[];
  onChange: (items: ResultItem[]) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  // publicId -> short-lived signed URL, so the owner sees what they uploaded.
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<number | null>(null);
  const [batch, setBatch] = useState<{ i: number; n: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const room = MAX - items.length;

  // Ask once per publicId — the ref keeps the effect off `thumbs`, which it sets.
  const requested = useRef(new Set<string>());
  const ids = items.map((i) => i.publicId).join(',');
  useEffect(() => {
    const missing = items
      .map((i) => i.publicId)
      .filter((id) => !requested.current.has(id))
      .slice(0, 24);
    if (!missing.length) return;
    missing.forEach((id) => requested.current.add(id));
    apiFetch(`/api/courses/${courseId}/media-urls`, {
      method: 'POST',
      body: JSON.stringify({ publicIds: missing }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.urls) setThumbs((prev) => ({ ...prev, ...d.urls }));
      })
      .catch(() => missing.forEach((id) => requested.current.delete(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, courseId]);

  async function addFiles(files: File[]) {
    setError(null);
    // Never upload past the cap — the schema rejects the save anyway.
    const queue = files.slice(0, room);
    const added: ResultItem[] = [];
    for (let i = 0; i < queue.length; i++) {
      setBatch({ i: i + 1, n: queue.length });
      const signed = await signCourseUpload(courseId, 'image');
      if ('error' in signed) {
        setError(signed.error === 'not_configured' ? he.cloudinaryMissing : he.uploadFailed);
        break;
      }
      setProgress(0);
      try {
        const result = await uploadToCloudinary(queue[i], signed.sign, setProgress);
        added.push({ publicId: result.public_id, caption: '' });
      } catch {
        setError(he.uploadFailed);
        break;
      }
    }
    setProgress(null);
    setBatch(null);
    // One state update for the whole batch, so a mid-batch failure still keeps
    // whatever already made it to Cloudinary.
    if (added.length) onChange([...items, ...added]);
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">{he.resultsHint}</p>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) addFiles(files);
        }}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={progress !== null || room <= 0}
        onClick={() => fileInput.current?.click()}
      >
        🖼️ {he.resultsAddPhotos}
      </Button>

      {progress !== null && (
        <div className="space-y-1.5">
          {batch && batch.n > 1 && (
            <p className="text-xs text-muted">
              {he.resultsUploadingCount.replace('{i}', String(batch.i)).replace('{n}', String(batch.n))}
            </p>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-ink/[0.07] rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-muted tabular-nums">
              {he.uploading} {progress}%
            </span>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger font-medium">{error}</p>}

      {items.length === 0 ? (
        <p className="text-sm text-muted">{he.resultsEmpty}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item, i) => (
            <li key={item.publicId} className="border border-line rounded-xl p-3 bg-paper/50 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted text-xs tabular-nums">{i + 1}</span>
                {thumbs[item.publicId] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumbs[item.publicId]}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover border border-line shrink-0"
                  />
                ) : (
                  <span className="w-12 h-12 rounded-lg bg-ink/[0.06] animate-pulse shrink-0" />
                )}
                <span className="text-muted text-xs truncate flex-1" dir="ltr">
                  {item.publicId.split('/').pop()}
                </span>
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  className="text-xs font-medium text-muted hover:text-ink disabled:opacity-30 transition-colors"
                  aria-label={he.moveUp}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === items.length - 1}
                  className="text-xs font-medium text-muted hover:text-ink disabled:opacity-30 transition-colors"
                  aria-label={he.moveDown}
                >
                  ↓
                </button>
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
