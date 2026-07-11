'use client';

import { useEffect, useRef } from 'react';

/** Thin accent-colored reading-progress bar fixed to the top of the page. */
export default function ScrollProgress({ accent }: { accent: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        el.style.transform = `scaleX(${p})`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fixed top-0 inset-x-0 z-50 h-[3px] pointer-events-none" aria-hidden>
      <div
        ref={ref}
        className="h-full origin-right will-change-transform"
        style={{ background: accent, transform: 'scaleX(0)' }}
      />
    </div>
  );
}
