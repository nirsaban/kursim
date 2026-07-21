'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { he } from '@/lib/he';

/** A bookmark toggle for saving a catalog course for later. */
export default function WishlistButton({
  courseId,
  initialSaved,
  className,
}: {
  courseId: string;
  initialSaved: boolean;
  className?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle(e: React.MouseEvent) {
    // Cards are often wrapped in a link — don't navigate when toggling.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    setError(false);
    const res = await apiFetch('/api/wishlist', {
      method: 'POST',
      body: JSON.stringify({ courseId }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      setSaved(Boolean(data.saved));
    } else {
      // Don't flip the optimistic state — the toggle didn't actually happen.
      setError(true);
      setTimeout(() => setError(false), 3000);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        title={error ? he.error : saved ? he.removeFromWishlist : he.addToWishlist}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 transition-colors disabled:opacity-50',
          saved
            ? 'bg-copper-100 text-copper-700'
            : 'bg-paper text-muted border border-line hover:text-ink',
          className,
        )}
      >
        <span aria-hidden>{saved ? '🔖' : '🏷️'}</span>
        {saved ? he.removeFromWishlist : he.addToWishlist}
      </button>
      {error && (
        <span
          role="status"
          className="absolute top-full end-0 mt-1 whitespace-nowrap text-[10px] font-semibold text-danger bg-card border border-line rounded-full px-2 py-0.5 shadow-card z-10"
        >
          {he.error}
        </span>
      )}
    </span>
  );
}
