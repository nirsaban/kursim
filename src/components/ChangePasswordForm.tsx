'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

export default function ChangePasswordForm({
  redirectTo,
  forced = false,
}: {
  redirectTo: string;
  /** True only for the mandatory first-login flow — shows the "before we let you in" framing. */
  forced?: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setBusy(false);
    if (res.ok) {
      router.push(redirectTo);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error === 'wrong_password' ? he.invalidCredentials : he.error);
    }
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted">
            {forced ? he.mustChangePassword : he.changePasswordTitle}
          </p>
          <Field label={he.currentPassword}>
            <Input
              type="password"
              required
              dir="ltr"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label={he.newPassword} hint={he.passwordHint}>
            <Input
              type="password"
              required
              minLength={8}
              dir="ltr"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          {error && (
            <div className="rounded-xl2 border border-danger-line bg-danger-soft px-5 py-4">
              <p className="text-sm text-danger font-medium">{error}</p>
            </div>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy && (
              <span
                className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
                aria-hidden="true"
              />
            )}
            {busy ? he.loading : he.save}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
