'use client';

import { useEffect, useState } from 'react';
import { he } from '@/lib/he';

function partsUntil(endsAt: string) {
  const end = new Date(`${endsAt}T23:59:59`).getTime();
  const diff = Math.max(0, end - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor(diff / 3_600_000) % 24,
    minutes: Math.floor(diff / 60_000) % 60,
    seconds: Math.floor(diff / 1_000) % 60,
    over: diff <= 0,
  };
}

/**
 * Live countdown to the sale's end date — the urgency driver of the sale
 * section. Renders nothing until mounted (avoids hydration mismatch) and
 * nothing once the sale is over.
 */
export default function SaleCountdown({
  endsAt,
  accent,
}: {
  endsAt: string;
  accent: string;
}) {
  const [t, setT] = useState<ReturnType<typeof partsUntil> | null>(null);

  useEffect(() => {
    setT(partsUntil(endsAt));
    const id = setInterval(() => setT(partsUntil(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!t || t.over) return null;

  const cells = [
    { v: t.days, label: he.countdownDays },
    { v: t.hours, label: he.countdownHours },
    { v: t.minutes, label: he.countdownMinutes },
    { v: t.seconds, label: he.countdownSeconds },
  ];

  return (
    <div className="mt-5">
      <p className="text-sm font-bold mb-2.5" style={{ color: accent }}>
        ⏳ {he.saleEndsIn}
      </p>
      <div className="flex gap-2.5" dir="ltr">
        {cells.map((c) => (
          <div
            key={c.label}
            className="w-[66px] rounded-[14px] border bg-card py-2.5 text-center shadow-card"
            style={{ borderColor: `${accent}33` }}
          >
            <div
              className="font-display font-black text-2xl tabular-nums leading-none"
              style={{ color: accent }}
            >
              {String(c.v).padStart(2, '0')}
            </div>
            <div className="text-[10px] text-muted font-semibold mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
