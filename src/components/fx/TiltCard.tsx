'use client';

import { useRef, useCallback } from 'react';
import { cn } from '@/lib/cn';

/**
 * Pointer-tracked 3D tilt with a moving glare highlight — the "premium card"
 * effect. Inert on touch devices and under prefers-reduced-motion; the child
 * simply renders flat there.
 */
export default function TiltCard({
  children,
  className,
  maxTilt = 7,
  glare = true,
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number>(0);

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'mouse') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width; // 0..1
      const py = (e.clientY - rect.top) / rect.height;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        el.style.transform = `rotateX(${(0.5 - py) * maxTilt * 2}deg) rotateY(${(px - 0.5) * maxTilt * 2}deg) translateZ(0)`;
        if (glareRef.current) {
          glareRef.current.style.opacity = '1';
          glareRef.current.style.background = `radial-gradient(360px circle at ${px * 100}% ${py * 100}%, rgba(255,253,248,0.16), transparent 60%)`;
        }
      });
    },
    [maxTilt],
  );

  const onLeave = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const el = ref.current;
    if (el) el.style.transform = '';
    if (glareRef.current) glareRef.current.style.opacity = '0';
  }, []);

  return (
    <div className="fx-stage h-full">
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        className={cn(
          'relative transition-transform duration-300 ease-out will-change-transform',
          className,
        )}
      >
        {children}
        {glare && (
          <div
            ref={glareRef}
            aria-hidden
            className="absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 pointer-events-none"
          />
        )}
      </div>
    </div>
  );
}
