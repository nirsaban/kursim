'use client';

import { useCallback, useEffect, useState } from 'react';
import { he } from '@/lib/he';
import type { LandingResultItem } from '@/components/landing/landing-types';

/**
 * Student-results gallery: a masonry wall of proof shots that opens into a
 * lightbox. Column count is CSS-driven so portrait and landscape photos mix
 * without letterboxing — the wall keeps its rhythm whatever the owner uploads.
 */
export default function ResultsGallery({
  items,
  accent,
}: {
  items: LandingResultItem[];
  accent: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const count = items.length;

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (delta: number) => setOpen((i) => (i === null ? null : (i + delta + count) % count)),
    [count],
  );

  // Arrow keys follow reading order: in RTL, "right" moves back through the wall.
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(-1);
      else if (e.key === 'ArrowLeft') step(1);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close, step]);

  const active = open === null ? null : items[open];

  return (
    <>
      <div className="columns-2 sm:columns-3 gap-3 sm:gap-4 [column-fill:_balance]">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={item.caption || he.resultsOpen}
            className="group relative mb-3 sm:mb-4 block w-full break-inside-avoid overflow-hidden rounded-2xl ring-1 ring-black/10 focus:outline-none focus-visible:ring-2"
            style={{ ['--tw-ring-color' as string]: `${accent}66` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.caption || he.resultsTitle}
              loading="lazy"
              className="w-full h-auto object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
            <span
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              aria-hidden
            />
            {item.caption && (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-start text-sm font-medium text-white translate-y-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                {item.caption}
              </span>
            )}
          </button>
        ))}
      </div>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={he.resultsTitle}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label={he.resultsClose}
            className="absolute top-4 end-4 w-11 h-11 rounded-full bg-white/10 text-white text-xl leading-none hover:bg-white/20 transition-colors"
          >
            ✕
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.url}
            alt={active.caption || he.resultsTitle}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl animate-rise"
          />

          {active.caption && (
            <p className="mt-4 max-w-xl text-center text-sm text-white/85">{active.caption}</p>
          )}

          {count > 1 && (
            <div
              className="mt-5 flex items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={he.resultsPrev}
                className="w-11 h-11 rounded-full bg-white/10 text-white text-lg hover:bg-white/20 transition-colors"
              >
                ›
              </button>
              <span
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-white tabular-nums"
                style={{ background: `${accent}cc` }}
                dir="ltr"
              >
                {open! + 1} / {count}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={he.resultsNext}
                className="w-11 h-11 rounded-full bg-white/10 text-white text-lg hover:bg-white/20 transition-colors"
              >
                ‹
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
