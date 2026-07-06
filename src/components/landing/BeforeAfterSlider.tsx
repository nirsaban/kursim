'use client';

import { useRef, useState } from 'react';

/**
 * Interactive before/after comparison: drag the handle (or the range slider,
 * which is also keyboard-accessible) to wipe between the two images.
 */
export default function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel,
  afterLabel,
  accent,
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel: string;
  afterLabel: string;
  accent: string;
}) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  function posFromPointer(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] rounded-xl2 overflow-hidden select-none touch-none bg-ink/5"
      onPointerMove={(e) => e.buttons === 1 && posFromPointer(e.clientX)}
      onPointerDown={(e) => posFromPointer(e.clientX)}
      dir="ltr"
    >
      {/* after (full) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterUrl}
        alt={afterLabel}
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
      {/* before (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt={beforeLabel}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* divider + handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.4)]"
        style={{ left: `${pos}%` }}
        aria-hidden
      >
        <span
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full text-white flex items-center justify-center text-sm font-bold shadow-lift"
          style={{ background: accent }}
        >
          ⇄
        </span>
      </div>

      {/* labels */}
      <span className="absolute top-3 left-3 bg-black/55 text-white text-xs font-semibold rounded-full px-2.5 py-1">
        {beforeLabel}
      </span>
      <span className="absolute top-3 right-3 bg-black/55 text-white text-xs font-semibold rounded-full px-2.5 py-1">
        {afterLabel}
      </span>

      {/* keyboard-accessible control */}
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`${beforeLabel} / ${afterLabel}`}
        className="absolute inset-x-4 bottom-3 opacity-0 focus:opacity-100 h-6 cursor-ew-resize"
      />
    </div>
  );
}
