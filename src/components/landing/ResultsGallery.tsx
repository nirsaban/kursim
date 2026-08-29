'use client';

import { useCallback, useEffect, useState } from 'react';
import Carousel from 'react-multi-carousel';
import 'react-multi-carousel/lib/styles.css';
import { he } from '@/lib/he';
import type { LandingResultItem } from '@/components/landing/landing-types';

/**
 * Student-results gallery: a swipeable carousel of proof shots that opens
 * into a lightbox. RTL-aware — react-multi-carousel's own `rtl` flag drives
 * the track direction, so "next" moves leftwards like the rest of the page.
 */

const RESPONSIVE = {
  desktop: { breakpoint: { max: 4000, min: 1024 }, items: 3, partialVisibilityGutter: 20 },
  tablet: { breakpoint: { max: 1024, min: 640 }, items: 2, partialVisibilityGutter: 16 },
  mobile: { breakpoint: { max: 640, min: 0 }, items: 1, partialVisibilityGutter: 30 },
};

function Arrow({
  onClick,
  label,
  glyph,
  side,
}: {
  onClick?: () => void;
  label: string;
  glyph: string;
  side: 'start' | 'end';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 text-black shadow-md grid place-items-center hover:bg-white transition-colors ${
        side === 'start' ? 'start-1' : 'end-1'
      }`}
    >
      {glyph}
    </button>
  );
}

export default function ResultsGallery({
  items,
  accent,
  deviceType,
}: {
  items: LandingResultItem[];
  accent: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}) {
  const [open, setOpen] = useState<number | null>(null);
  const count = items.length;

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (delta: number) => setOpen((i) => (i === null ? null : (i + delta + count) % count)),
    [count],
  );

  // Arrow keys follow reading order: in RTL, "right" moves back through the set.
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
      <div className="relative results-carousel">
        <Carousel
          responsive={RESPONSIVE}
          ssr
          deviceType={deviceType}
          rtl
          infinite={count > 3}
          draggable
          swipeable
          keyBoardControl
          showDots={count > 1}
          renderDotsOutside
          partialVisible
          itemClass="px-2"
          containerClass="pb-2"
          dotListClass="results-dots"
          customLeftArrow={<Arrow label={he.resultsNext} glyph="‹" side="end" />}
          customRightArrow={<Arrow label={he.resultsPrev} glyph="›" side="start" />}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(i)}
              aria-label={item.caption || he.resultsOpen}
              className="group relative block w-full overflow-hidden rounded-2xl ring-1 ring-black/10 focus:outline-none focus-visible:ring-2"
              style={{ ['--tw-ring-color' as string]: `${accent}66` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.caption || he.resultsTitle}
                loading="lazy"
                className="w-full aspect-[3/4] object-contain bg-black/[0.04]"
              />
              <span
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
              />
              {item.caption && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-start text-sm font-medium text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {item.caption}
                </span>
              )}
            </button>
          ))}
        </Carousel>

        {/* Dot styling has to reach into the library's own markup. */}
        <style>{`
          .results-carousel .results-dots { position: static; margin-top: 1.25rem; }
          .results-carousel .results-dots li button {
            width: 7px; height: 7px; border: 0; border-radius: 9999px;
            background: currentColor; opacity: .25; transition: all .25s ease;
          }
          .results-carousel .results-dots li.react-multi-carousel-dot--active button {
            width: 22px; opacity: 1; background: ${accent};
          }
        `}</style>
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
            <div className="mt-5 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
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
