'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';

export default function RedeemForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiFetch('/api/access-codes/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      const data = await res.json();
      setSuccess(true);
      redirectTimer.current = setTimeout(() => {
        router.push(`/t/${slug}/course/${data.courseId}`);
      }, 1500);
    } else {
      setBusy(false);
      setError(he.redeemInvalid);
    }
  }

  if (success) {
    return <p className="text-ok font-semibold text-center py-4">{he.redeemSuccess}</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={he.redeemCode}>
        <Input
          dir="ltr"
          required
          minLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="text-center text-lg font-bold tracking-widest"
          autoComplete="off"
        />
      </Field>
      {error && (
        <div className="rounded-xl2 border border-danger-line bg-danger-soft px-5 py-4">
          <p className="text-sm text-danger font-medium">{error}</p>
        </div>
      )}
      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {busy && (
          <span
            className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
            aria-hidden="true"
          />
        )}
        {he.redeemSubmit}
      </Button>
    </form>
  );
}
