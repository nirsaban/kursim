'use client';

import { useRef } from 'react';
import { ScrollFrameSequence } from '@/components/media/ScrollFrameSequence';

export interface CourseRevealSequenceProps {
  framesPath: string;
  frameCount: number;
  poster: string;
  headline: string;
  badge?: string;
  accent: string;
}

/**
 * Full-bleed cinematic hero: the AI-generated clip plays as a pinned,
 * scroll-scrubbed frame sequence with the course headline overlaid. On mobile
 * it becomes a single-screen auto-playing reveal (no scroll-jacking).
 */
export default function CourseRevealSequence({
  framesPath,
  frameCount,
  poster,
  headline,
  badge,
  accent,
}: CourseRevealSequenceProps) {
  const trackRef = useRef<HTMLElement>(null);

  return (
    <section ref={trackRef} aria-hidden={false} className="relative h-[100svh] w-full md:h-[300vh]">
      <div className="relative h-[100svh] w-full overflow-hidden md:sticky md:top-0 md:h-screen">
        <ScrollFrameSequence
          framesPath={framesPath}
          frameCount={frameCount}
          poster={poster}
          trackRef={trackRef}
          mode="track"
          className="absolute inset-0"
        />

        {/* legibility scrim for the overlaid copy */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/25" />

        {/* overlaid headline */}
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-5xl mx-auto w-full px-6 pb-16 sm:pb-24">
            {badge && (
              <span
                className="inline-flex items-center gap-2 text-[13px] font-bold rounded-full px-3.5 py-1.5 mb-5 text-white"
                style={{ background: `${accent}CC` }}
              >
                {badge}
              </span>
            )}
            <h1 className="font-display text-4xl sm:text-[56px] font-black leading-[1.12] max-w-3xl text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.5)]">
              {headline}
            </h1>
          </div>
        </div>

        {/* scroll hint (desktop only) */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 md:block">
          <span className="block h-9 w-6 rounded-full border-2 border-white/60" />
        </div>
      </div>
    </section>
  );
}
