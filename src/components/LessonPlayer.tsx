'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';

export interface PlayAttachment {
  id: string;
  filename: string;
  kind: string;
  url: string;
}

interface PlayData {
  configured: boolean;
  videoUrl: string | null;
  attachments: PlayAttachment[];
}

/**
 * Student player: signed media URLs, 30s heartbeat (drives "who's watching"
 * and eviction ordering), periodic progress saves, completion at 90%, and
 * auto-advance to the next lecture when the video ends.
 */
export default function LessonPlayer({
  lessonId,
  initialPositionSec,
  isStudent,
  nextHref,
  onData,
  onCompleted,
}: {
  lessonId: string;
  initialPositionSec: number;
  isStudent: boolean;
  nextHref?: string | null;
  /** Lifts the signed attachment list to the surrounding workspace. */
  onData?: (attachments: PlayAttachment[]) => void;
  onCompleted?: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<PlayData | null>(null);
  const [failed, setFailed] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/lessons/${lessonId}/play`)
      .then(async (res) => {
        if (!res.ok) throw new Error('play failed');
        const body = (await res.json()) as PlayData;
        if (!cancelled) {
          setData(body);
          onData?.(body.attachments);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (completed) {
      completedRef.current = true;
      onCompleted?.();
    }
    apiFetch('/api/progress', {
      method: 'POST',
      body: JSON.stringify({ lessonId, lastPositionSec: pos, completed }),
    }).catch(() => {});
  }

  function onEnded() {
    saveProgress(true);
    if (!nextHref) return;
    setAdvancing(true);
    setTimeout(() => router.push(nextHref), 1500);
  }

  if (failed) {
    return (
      <div className="aspect-video max-h-[70vh] w-full flex items-center justify-center text-danger font-medium bg-brand-950">
        {he.error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="aspect-video max-h-[70vh] w-full bg-brand-950 animate-pulse flex items-center justify-center text-brand-300">
        {he.loading}
      </div>
    );
  }

  if (!data.videoUrl) {
    return (
      <div className="aspect-video max-h-[70vh] w-full bg-brand-950 text-brand-300 flex flex-col items-center justify-center text-center p-8 gap-2">
        <span className="text-3xl" aria-hidden>
          🎬
        </span>
        <p>{data.configured ? he.noVideo : he.cloudinaryMissing}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <video
        ref={videoRef}
        controls
        controlsList="nodownload"
        className="w-full aspect-video max-h-[70vh] bg-black"
        src={data.videoUrl}
        onLoadedMetadata={() => {
          const video = videoRef.current;
          if (video && initialPositionSec > 5 && initialPositionSec < video.duration - 5) {
            video.currentTime = initialPositionSec;
          }
        }}
        onTimeUpdate={() => saveProgress()}
        onPause={() => saveProgress(true)}
        onEnded={onEnded}
      />
      {advancing && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 text-white font-bold text-lg">
          {he.learnAutoNext}
        </div>
      )}
    </div>
  );
}
