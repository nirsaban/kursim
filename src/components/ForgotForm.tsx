'use client';

import { useState } from 'react';
import Link from 'next/link';
import { he } from '@/lib/he';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';

/**
 * Step 1 of password recovery. An address with no account in this school gets
 * told so (`found: false`) — email is unique per school, and people routinely
 * try the school they don't have an account in.
 */
export default function ForgotForm({ tenantSlug }: { tenantSlug: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tenantSlug }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.found === false) setNotFound(true);
        else setSent(true);
      } else setError(he.error);
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
      {notFound && (
        <div className="rounded-xl2 border border-danger-line bg-danger-soft px-5 py-4">
          <p className="font-display font-black text-danger text-sm">{he.forgotNotFoundTitle}</p>
          <p className="text-sm text-danger/90 mt-1 leading-relaxed">{he.forgotNotFoundBody}</p>
        </div>
      )}
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
