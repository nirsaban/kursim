'use client';

import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/components/media/hooks';

/**
 * Conversion bar pinned to the bottom of the viewport. Hidden over the hero
 * (its own CTA is visible there) and slides up once the visitor scrolls past
 * it — on every screen size, not just mobile.
 */
export default function StickyCta({
  href,
  external,
  text,
  priceText,
  note,
  accent,
  deep,
  locked,
}: {
  href: string;
  external: boolean;
  text: string;
  priceText?: string;
  note?: string;
  accent: string;
  deep: string;
  locked: boolean;
}) {
  const [shown, setShown] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={
        reduced
          ? `fixed bottom-0 inset-x-0 z-40 transition-none ${
              shown ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`
          : `fixed bottom-0 inset-x-0 z-40 transition-transform duration-500 ease-out ${
              shown ? 'translate-y-0' : 'translate-y-full'
            }`
      }
      aria-hidden={!shown}
    >
      <div className="bg-card/95 backdrop-blur border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="min-w-0 flex-1 hidden sm:block">
            {note && <p className="text-xs text-muted truncate">{note}</p>}
          </div>
          {priceText && (
            <b className="text-ink font-display font-bold text-lg shrink-0">{priceText}</b>
          )}
          <a
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="flex-1 sm:flex-none min-h-[48px] inline-flex items-center justify-center gap-2 font-bold rounded-lg px-7 text-card transition-opacity hover:opacity-90"
            style={{ background: accent }}
            tabIndex={shown ? 0 : -1}
          >
            {locked && <span aria-hidden>🔒</span>}
            {text}
          </a>
        </div>
      </div>
    </div>
  );
}
