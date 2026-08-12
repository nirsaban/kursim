'use client';

import { useState } from 'react';
import Link from 'next/link';
import { he } from '@/lib/he';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';

/**
 * Step 1 of password recovery. The endpoint answers identically whether or not
 * the address has an account, so this screen shows the same confirmation
 * either way — by design, not by oversight.
 */
export default function ForgotForm({ tenantSlug }: { tenantSlug: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tenantSlug }),
      });
      if (res.ok) setSent(true);
      else setError(he.error);
    } catch {
      setError(he.error);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl2 border border-line bg-paper px-5 py-4">
          <p className="font-display font-black text-ink">{he.forgotSentTitle}</p>
          <p className="text-sm text-muted mt-1 leading-relaxed">{he.forgotSentBody}</p>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          {he.supportLine.replace('{phone}', he.supportPhone)}
        </p>
        <Link
          href={`/t/${tenantSlug}/login`}
          className="block text-center text-sm text-muted hover:text-ink"
        >
          {he.backToLogin}
        </Link>
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
      <Field label={he.email} hint={he.forgotEmailHint}>
        <Input
          type="email"
          required
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </Field>
      {error && <p className="text-sm text-danger font-medium">{error}</p>}
      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {busy ? he.forgotSending : he.forgotSubmit}
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
