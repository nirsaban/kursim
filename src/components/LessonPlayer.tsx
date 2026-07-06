'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';

interface PlayData {
  configured: boolean;
  videoUrl: string | null;
  attachments: Array<{ id: string; filename: string; kind: string; url: string }>;
}

/**
 * Student player: signed media URLs, 30s heartbeat (drives "who's watching"
 * and eviction ordering), periodic progress saves, completion at 90%.
 */
export default function LessonPlayer({
  lessonId,
  initialPositionSec,
  isStudent,
}: {
  lessonId: string;
  initialPositionSec: number;
  isStudent: boolean;
}) {
  const [data, setData] = useState<PlayData | null>(null);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/lessons/${lessonId}/play`)
      .then(async (res) => {
        if (!res.ok) throw new Error('play failed');
        const body = (await res.json()) as PlayData;
        if (!cancelled) setData(body);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  // Heartbeat every 30s while the lesson is open.
  useEffect(() => {
    const beat = () => apiFetch('/api/auth/heartbeat', { method: 'POST' }).catch(() => {});
    beat();
    const interval = setInterval(beat, 30_000);
    return () => clearInterval(interval);
  }, []);

  function saveProgress(force = false) {
    if (!isStudent) return;
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const pos = Math.floor(video.currentTime);
    if (!force && Math.abs(pos - lastSaved.current) < 10) return;
    lastSaved.current = pos;
    const completed = !completedRef.current && video.currentTime / video.duration >= 0.9;
    if (completed) completedRef.current = true;
    apiFetch('/api/progress', {
      method: 'POST',
      body: JSON.stringify({ lessonId, lastPositionSec: pos, completed }),
    }).catch(() => {});
  }

  if (failed) {
    return (
      <div className="bg-danger/5 border border-danger/25 rounded-xl2 p-6 text-danger font-medium">
        {he.error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-xl2 bg-ink/[0.04] aspect-video animate-pulse flex items-center justify-center text-muted">
        {he.loading}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {data.videoUrl ? (
        <video
          ref={videoRef}
          controls
          controlsList="nodownload"
          className="w-full rounded-xl2 bg-brand-950 aspect-video shadow-lift"
          src={data.videoUrl}
          onLoadedMetadata={() => {
            const video = videoRef.current;
            if (video && initialPositionSec > 5 && initialPositionSec < video.duration - 5) {
              video.currentTime = initialPositionSec;
            }
          }}
          onTimeUpdate={() => saveProgress()}
          onPause={() => saveProgress(true)}
          onEnded={() => saveProgress(true)}
        />
      ) : (
        <div className="bg-white border border-line rounded-xl2 aspect-video flex flex-col items-center justify-center text-center p-8 gap-2">
          <span className="text-3xl" aria-hidden>
            🎬
          </span>
          <p className="text-muted">{data.configured ? he.noVideo : he.cloudinaryMissing}</p>
        </div>
      )}

      {data.attachments.length > 0 && (
        <div className="bg-white border border-line rounded-xl2 shadow-card p-5">
          <p className="kicker mb-3">{he.attachments}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 border border-line rounded-xl px-3.5 py-2.5 text-sm font-medium hover:border-brand-300 hover:bg-brand-50 transition-colors"
                >
                  <span aria-hidden>📎</span>
                  <span className="truncate">{a.filename}</span>
                  <span className="ms-auto text-xs text-brand-700">{he.download}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
