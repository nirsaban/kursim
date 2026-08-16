'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';

export default function AcceptTermsForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await apiFetch('/api/auth/accept-terms', { method: 'POST' });
    setBusy(false);
    if (res.ok) {
      router.replace(`/t/${slug}`);
      router.refresh();
    } else {
      setError(he.error);
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-1 w-4 h-4 accent-copper-500"
        />
        <span className="text-sm text-ink">{he.termsAgreeLabel}</span>
      </label>
      <Button onClick={accept} disabled={!checked || busy} className="w-full">
        {busy ? he.termsAccepting : he.termsAcceptCta}
      </Button>
      {error && <p className="text-sm text-danger font-medium">{error}</p>}
    </div>
  );
}
