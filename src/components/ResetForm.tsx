'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { he } from '@/lib/he';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';

/** Step 2 of password recovery: redeem the emailed token and pick a password. */
export default function ResetForm({
  tenantSlug,
  token,
}: {
  tenantSlug: string;
  token: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (password !== confirm) {
      setError(he.resetMismatch);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        return;
      }
      if (data.error === 'invalid_token') setError(he.resetInvalidBody);
      else if (data.error === 'too_many_attempts') setError(he.tooManyAttempts);
      else setError(he.error);
    } catch {
      setError(he.error);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl2 border border-line bg-paper px-5 py-4">
          <p className="font-display font-black text-ink">{he.resetDoneTitle}</p>
          <p className="text-sm text-muted mt-1 leading-relaxed">{he.resetDoneBody}</p>
        </div>
        <Button size="lg" className="w-full" onClick={() => router.push(`/t/${tenantSlug}/login`)}>
          {he.login}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <Field label={he.newPassword} hint={he.passwordHint}>
        <Input
          type="password"
          required
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <Field label={he.resetConfirmLabel}>
        <Input
          type="password"
          required
          dir="ltr"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
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
        {busy ? he.resetSaving : he.resetSubmit}
      </Button>
      <Link
        href={`/t/${tenantSlug}/login`}
        className="block text-center text-sm text-muted hover:text-ink"
      >
        {he.backToLogin}
      </Link>
    </form>
  );
}
