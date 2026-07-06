'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { he } from '@/lib/he';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';

export default function AcceptInviteForm({
  token,
  tenantSlug,
}: {
  token: string;
  tenantSlug: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email, password }),
    });
    setBusy(false);
    if (res.ok) {
      router.push(`/t/${tenantSlug}/login`);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.error === 'email_taken') setError(he.emailTaken);
    else if (data.error === 'too_many_attempts') setError(he.tooManyAttempts);
    else setError(he.invalidInvite);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={he.email}>
        <Input
          type="email"
          required
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </Field>
      <Field label={he.password} hint="לפחות 8 תווים">
        <Input
          type="password"
          required
          minLength={8}
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
      {error && <p className="text-sm text-danger font-medium">{error}</p>}
      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {he.createAccount}
      </Button>
    </form>
  );
}
