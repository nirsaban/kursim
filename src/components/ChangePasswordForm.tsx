'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

export default function ChangePasswordForm({ redirectTo }: { redirectTo: string }) {
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
          <p className="text-sm text-muted">{he.mustChangePassword}</p>
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
          <Field label={he.newPassword} hint="לפחות 8 תווים">
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
          {error && <p className="text-sm text-danger font-medium">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {he.save}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
