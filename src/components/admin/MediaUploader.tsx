'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { signCourseUpload, uploadToCloudinary } from '@/lib/client/upload';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';

interface Attachment {
  id: string;
  filename: string;
  kind: string;
}

/** Direct browser→Cloudinary upload of a lesson video / attachments (server only signs). */
export default function MediaUploader({
  courseId,
  lessonId,
  hasVideo,
  attachments,
  onChanged,
}: {
  courseId: string;
  lessonId: string;
  hasVideo: boolean;
  attachments: Attachment[];
  onChanged: () => void;
}) {
  const videoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File, kind: 'video' | 'image' | 'raw') {
    setError(null);
    const signed = await signCourseUpload(courseId, kind);
    if ('error' in signed) {
      setError(signed.error === 'not_configured' ? he.cloudinaryMissing : he.uploadFailed);
      return null;
    }
    setProgress(0);
    try {
      return await uploadToCloudinary(file, signed.sign, setProgress);
    } catch {
      setError(he.uploadFailed);
      return null;
    } finally {
      setProgress(null);
    }
  }

  async function uploadVideo(file: File) {
    const result = await upload(file, 'video');
    if (!result) return;
    const attach = await apiFetch(`/api/lessons/${lessonId}/video`, {
      method: 'POST',
      body: JSON.stringify({
        publicId: result.public_id,
        durationSec: result.duration ? Math.round(result.duration) : null,
        bytes: result.bytes,
      }),
    });
    if (attach.ok) onChanged();
    else setError(he.uploadFailed);
  }

  async function uploadAttachment(file: File) {
    const kind = file.type.startsWith('image/') ? ('image' as const) : ('raw' as const);
    const result = await upload(file, kind);
    if (!result) return;
    const attach = await apiFetch(`/api/lessons/${lessonId}/attachments`, {
      method: 'POST',
      body: JSON.stringify({
        publicId: result.public_id,
        filename: file.name,
        kind: kind === 'image' ? 'IMAGE' : 'DOC',
      }),
    });
    if (attach.ok) onChanged();
    else setError(he.uploadFailed);
  }

  async function removeVideo() {
    if (!confirm(he.confirmDelete)) return;
    await apiFetch(`/api/lessons/${lessonId}/video`, { method: 'DELETE' });
    onChanged();
  }

  async function removeAttachment(id: string) {
    if (!confirm(he.confirmDelete)) return;
    await apiFetch(`/api/attachments/${id}`, { method: 'DELETE' });
    onChanged();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={videoInput}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])}
        />
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadAttachment(e.target.files[0])}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={progress !== null}
          onClick={() => videoInput.current?.click()}
        >
          🎬 {hasVideo ? he.replaceVideo : he.uploadVideo}
        </Button>
        {hasVideo && (
          <button
            type="button"
            onClick={removeVideo}
            className="text-xs font-medium text-muted hover:text-danger transition-colors"
          >
            {he.removeVideo}
          </button>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={progress !== null}
          onClick={() => fileInput.current?.click()}
        >
          📎 {he.addAttachment}
        </Button>
      </div>

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

      {attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-sm">
              <span>📎 {a.filename}</span>
              <button
                onClick={() => removeAttachment(a.id)}
                className="text-xs font-medium text-muted hover:text-danger transition-colors"
              >
                {he.delete}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
