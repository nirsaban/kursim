'use client';

import { useState } from 'react';
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
      setTimeout(() => {
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
      {error && <p className="text-sm text-danger font-medium">{error}</p>}
      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {he.redeemSubmit}
      </Button>
    </form>
  );
}
