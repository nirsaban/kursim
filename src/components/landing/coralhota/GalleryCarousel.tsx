'use client';

import { useRef } from 'react';

/** Horizontal scroll-snap strip with prev/next arrows, like the reference's video carousel. */
export default function GalleryCarousel({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex gap-5 overflow-x-auto snap-x snap-mandatory px-4 max-w-5xl mx-auto pb-2 [scrollbar-width:thin]"
      >
        {children}
      </div>
      <div className="hidden sm:flex items-center gap-2 max-w-5xl mx-auto px-4 mt-3">
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="הבא"
          className="w-9 h-9 rounded-full border border-black/15 bg-white grid place-items-center hover:bg-black hover:text-white transition-colors"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="הקודם"
          className="w-9 h-9 rounded-full border border-black/15 bg-white grid place-items-center hover:bg-black hover:text-white transition-colors"
        >
          →
        </button>
      </div>
    </div>
  );
}
