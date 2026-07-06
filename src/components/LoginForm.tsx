'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { he } from '@/lib/he';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';

interface DeviceInfo {
  deviceLabel: string;
  ip: string;
  lastSeenAt: number;
}

export default function LoginForm({ tenantSlug }: { tenantSlug?: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const evicted = search.get('evicted') === '1';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDevices(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, tenantSlug }),
      });
      const data = await res.json();
      if (res.ok) {
        const next = search.get('next');
        if (data.mustChangePassword && tenantSlug) {
          router.push(`/t/${tenantSlug}/change-password`);
        } else {
          router.push(next && next.startsWith('/') ? next : data.redirect);
        }
        return;
      }
      if (data.error === 'device_limit') {
        setError(he.deviceLimitReached);
        setDevices(data.sessions ?? []);
      } else if (data.error === 'too_many_attempts') {
        setError(he.tooManyAttempts);
      } else if (data.error === 'account_suspended') {
        setError(he.accountSuspended);
      } else {
        setError(he.invalidCredentials);
      }
    } catch {
      setError(he.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {evicted && (
        <div className="rounded-xl bg-warn/10 border border-warn/25 text-warn px-4 py-3 text-sm font-medium">
          {he.evictedNotice}
        </div>
      )}
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
        <Field label={he.password}>
          <Input
            type="password"
            required
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        {error && <p className="text-sm text-danger font-medium">{error}</p>}
        {devices && (
          <div className="rounded-xl bg-paper border border-line p-4 text-sm space-y-2">
            <p className="text-muted">{he.deviceLimitExplain}</p>
            <p className="font-semibold">{he.activeDevices}:</p>
            <ul className="space-y-1.5">
              {devices.map((d, i) => (
                <li key={i} className="flex justify-between text-muted">
                  <span>{d.deviceLabel || he.device}</span>
                  <span dir="ltr" className="tabular-nums">
                    {new Date(d.lastSeenAt).toLocaleString('he-IL')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button type="submit" size="lg" disabled={busy} className="w-full">
          {busy ? he.loggingIn : he.login}
        </Button>
      </form>
    </div>
  );
}
