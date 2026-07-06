'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import ProgressBar from '@/components/ui/ProgressBar';
import Button from '@/components/ui/Button';

interface AffiliateStats {
  code: string;
  url: string;
  visits: number;
  coins: number;
  visitsPerCoin: number;
}

/** Enrolled student's share-and-earn card: personal link, unique visits, coins. */
export default function AffiliateCard({ courseId }: { courseId: string }) {
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch(`/api/courses/${courseId}/affiliate`, { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStats(d))
      .catch(() => {});
  }, [courseId]);

  if (!stats) return null;

  const intoCurrent = stats.visits % stats.visitsPerCoin;
  const toNext = stats.visitsPerCoin - intoCurrent;
  const pct = Math.round((intoCurrent / stats.visitsPerCoin) * 100);

  return (
    <section className="bg-white border border-line rounded-xl2 shadow-card p-5">
      <h2 className="font-display font-bold text-lg">{he.affiliateTitle}</h2>
      <p className="text-sm text-muted mt-1">
        {he.affiliateHint.replace('{n}', String(stats.visitsPerCoin))}
      </p>

      <div className="flex items-center gap-2 mt-4">
        <code
          dir="ltr"
          className="flex-1 text-xs bg-paper border border-line rounded-lg px-3 py-2.5 truncate"
        >
          {stats.url}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(stats.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? he.copied : he.copy}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-5">
        <div className="bg-paper rounded-xl p-4 text-center">
          <p className="font-display text-2xl font-bold tabular-nums">{stats.visits}</p>
          <p className="text-xs text-muted mt-0.5">{he.affiliateVisits}</p>
        </div>
        <div className="bg-warn/10 rounded-xl p-4 text-center">
          <p className="font-display text-2xl font-bold tabular-nums text-warn">
            🪙 {stats.coins}
          </p>
          <p className="text-xs text-muted mt-0.5">{he.affiliateCoins}</p>
        </div>
      </div>

      <div className="mt-4">
        <ProgressBar value={pct} />
        <p className="text-xs text-muted mt-1.5">
          {he.affiliateToNext.replace('{n}', String(toNext))}
        </p>
      </div>
    </section>
  );
}
