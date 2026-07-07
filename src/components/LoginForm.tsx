'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { he } from '@/lib/he';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import SeatDots from '@/components/ui/SeatDots';
import DeviceIcon from '@/components/ui/DeviceIcon';
import { relativeHe, isLiveNow } from '@/lib/relative-time';

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

  async function doLogin() {
    setBusy(true);
    setError(null);
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
        setDevices(data.sessions ?? []);
      } else {
        setDevices(null);
        if (data.error === 'too_many_attempts') {
          setError(he.tooManyAttempts);
        } else if (data.error === 'account_suspended') {
          setError(he.accountSuspended);
        } else {
          setError(he.invalidCredentials);
        }
      }
    } catch {
      setError(he.error);
    } finally {
      setBusy(false);
    }
  }

  // Flagship state: the account is at its device limit — the seats are full.
  if (devices) {
    const n = devices.length;
    return (
      <div>
        <div className="flex items-center gap-3.5 flex-wrap">
          <SeatDots
            seats={Array.from({ length: n }, (_, i) => (i === 0 ? 'limit-active' : 'limit'))}
          />
          <span className="text-xs font-bold text-warn bg-warn-soft px-3 py-1 rounded-full">
            <span dir="ltr">{n}</span> {he.outOf} <span dir="ltr">{n}</span> {he.devicesInUse}
          </span>
        </div>
        <h2 className="font-display text-2xl font-black text-ink mt-3.5 mb-2">
          {he.deviceLimitTitle}
        </h2>
        <p className="text-sm leading-relaxed text-muted mb-5">{he.deviceLimitBody}</p>
        <ul className="space-y-2.5 mb-5">
          {devices.map((d, i) => {
            const live = isLiveNow(d.lastSeenAt);
            return (
              <li
                key={i}
                className="flex items-center gap-3.5 border border-line rounded-[14px] px-4 py-3 bg-card"
              >
                <DeviceIcon label={d.deviceLabel || ''} className="text-ink shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">
                    {d.deviceLabel || he.device}
                  </div>
                  <div className="text-xs text-muted">
                    {he.lastSeen} {relativeHe(d.lastSeenAt)}
                  </div>
                </div>
                <span
                  className={
                    live
                      ? 'w-2 h-2 rounded-full bg-live animate-pulse-live shrink-0'
                      : 'w-2 h-2 rounded-full bg-seat shrink-0'
                  }
                />
              </li>
            );
          })}
        </ul>
        <Button size="lg" className="w-full" disabled={busy} onClick={doLogin}>
          {busy ? he.loggingIn : he.retryAfterLogout}
        </Button>
        <button
          type="button"
          className="block w-full text-center text-sm text-muted hover:text-ink mt-3"
          onClick={() => setDevices(null)}
        >
          {he.backToLogin}
        </button>
        <p className="text-xs text-muted text-center mt-3">{he.dontRecognizeHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {evicted && (
        <div className="rounded-xl2 border border-line bg-paper px-5 py-4">
          <SeatDots seats={['idle', 'active', 'free']} size="sm" className="mb-2" />
          <p className="font-display font-black text-ink">{he.evictedNotice}</p>
          <p className="text-sm text-muted mt-1 leading-relaxed">{he.evictedBody}</p>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          doLogin();
        }}
        className="space-y-4"
      >
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
        <Button type="submit" size="lg" disabled={busy} className="w-full">
          {busy ? he.loggingIn : he.login}
        </Button>
      </form>
    </div>
  );
}
