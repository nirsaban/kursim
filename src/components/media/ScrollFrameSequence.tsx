'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useIsMobile, usePrefersReducedMotion } from './hooks';

/**
 * Apple-style scroll-controlled image-sequence renderer (ported from the
 * GeniriFlow landing page). Draws a sequence of JPG frames onto a <canvas>,
 * mapping the scroll progress of `trackRef` (0 → 1) to a frame index. Frames
 * are drawn "cover", the canvas resizes with its container, and rendering is
 * smoothed via requestAnimationFrame.
 *
 * - First frame paints immediately; the rest preload in the background.
 * - While a target frame isn't loaded, the nearest loaded frame is shown.
 * - Reduced-motion / data-saver → a single static poster image.
 * - Mobile → the sequence auto-plays on a timer (no scroll-jacking).
 */
export interface ScrollFrameSequenceProps {
  framesPath: string; // e.g. https://res.cloudinary.com/.../marketing/courses/ID
  frameCount: number;
  poster: string;
  trackRef: React.RefObject<HTMLElement | null>;
  mode?: 'track' | 'transit';
  pad?: number;
  ext?: string;
  className?: string;
}

const frameUrl = (path: string, n: number, pad: number, ext: string) =>
  `${path}/frame_${String(n).padStart(pad, '0')}.${ext}`;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function ScrollFrameSequence({
  framesPath,
  frameCount,
  poster,
  trackRef,
  mode = 'track',
  pad = 4,
  ext = 'jpg',
  className,
}: ScrollFrameSequenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const imagesRef = useRef<(HTMLImageElement | undefined)[]>([]);
  const loadedRef = useRef<boolean[]>([]);
  const targetFrameRef = useRef(0);
  const currentFrameRef = useRef(0);
  const lastDrawnRef = useRef(-1);
  const rafRef = useRef<number | null>(null);

  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  const [saveData, setSaveData] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType ?? ''))) {
      setSaveData(true);
    }
  }, []);

  const useFallback = !mounted || reducedMotion || saveData;

  useEffect(() => {
    if (useFallback) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    imagesRef.current = new Array(frameCount);
    loadedRef.current = new Array(frameCount).fill(false);
    let cancelled = false;

    const autoPlay = isMobile;
    const AUTOPLAY_FPS = 30;
    let lastTs = 0;

    function nearestLoaded(idx: number): HTMLImageElement | undefined {
      if (loadedRef.current[idx]) return imagesRef.current[idx];
      for (let r = 1; r < frameCount; r++) {
        if (idx - r >= 0 && loadedRef.current[idx - r]) return imagesRef.current[idx - r];
        if (idx + r < frameCount && loadedRef.current[idx + r]) return imagesRef.current[idx + r];
      }
      return undefined;
    }

    function drawFrame(idx: number) {
      const img = nearestLoaded(idx);
      if (!img || !canvas || !ctx) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!iw || !ih) return;
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }

    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      lastDrawnRef.current = -1;
      drawFrame(Math.round(currentFrameRef.current));
    }

    function loadImage(i: number) {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          imagesRef.current[i] = img;
          loadedRef.current[i] = true;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = frameUrl(framesPath, i + 1, pad, ext); // files are 1-indexed
      });
    }

    function onScroll() {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const vh = window.innerHeight;
      let progress: number;
      if (mode === 'transit') {
        progress = clamp((vh - rect.top) / (vh + rect.height), 0, 1);
      } else {
        const denom = rect.height - vh;
        progress = denom > 0 ? clamp(-rect.top / denom, 0, 1) : 0;
      }
      targetFrameRef.current = progress * (frameCount - 1);
    }

    function tick(ts: number) {
      if (autoPlay) {
        if (lastTs) {
          const dt = (ts - lastTs) / 1000;
          currentFrameRef.current = (currentFrameRef.current + dt * AUTOPLAY_FPS) % frameCount;
        }
        lastTs = ts;
      } else {
        currentFrameRef.current += (targetFrameRef.current - currentFrameRef.current) * 0.15;
      }
      const idx = Math.round(currentFrameRef.current) % frameCount;
      if (idx !== lastDrawnRef.current) {
        drawFrame(idx);
        lastDrawnRef.current = idx;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    (async () => {
      await loadImage(0);
      if (cancelled) return;
      drawFrame(0);
      lastDrawnRef.current = 0;

      const concurrency = 6;
      let next = 1;
      const worker = async () => {
        while (!cancelled && next < frameCount) {
          const i = next++;
          await loadImage(i);
          if (!cancelled && Math.round(currentFrameRef.current) === i) drawFrame(i);
        }
      };
      await Promise.all(Array.from({ length: concurrency }, worker));
    })();

    resize();
    if (!autoPlay) onScroll();
    rafRef.current = requestAnimationFrame(tick);

    if (!autoPlay) window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      ro.disconnect();
    };
  }, [useFallback, framesPath, frameCount, pad, ext, trackRef, mode, isMobile]);

  if (useFallback) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={poster}
        alt=""
        aria-hidden="true"
        className={cn('h-full w-full object-cover', className)}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('block h-full w-full', className)}
      style={{
        backgroundImage: `url(${poster})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    />
  );
}
