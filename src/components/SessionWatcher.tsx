'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { he } from '@/lib/he';
import { loginPathFor } from '@/lib/client/api';
import SeatDots from '@/components/ui/SeatDots';

const REDIRECT_DELAY_MS = 1200;

/**
 * Holds the SSE eviction channel. The moment this session is evicted (device
 * limit, admin kill, suspension) the server pushes `evicted`. We show a brief
 * in-page notice — same copy the login page renders for `?evicted=1` — so the
 * page doesn't yank out from under the user, then bounce to login.
 * Reconnects automatically while the session is alive.
 */
export default function SessionWatcher() {
  const [evicted, setEvicted] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    let source: EventSource | null = null;
    let stopped = false;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    const onEvicted = () => {
      if (stopped) return;
      stopped = true;
      source?.close();
      setEvicted(true);
      redirectTimer = setTimeout(() => {
        const login = loginPathFor(window.location.pathname);
        window.location.href = `${login}?evicted=1`;
      }, REDIRECT_DELAY_MS);
    };

    const connect = () => {
      if (stopped) return;
      source = new EventSource('/api/auth/events');
      source.addEventListener('evicted', onEvicted);
      source.onerror = () => {
        // Network blip or server restart: EventSource retries by itself.
        // A dead session is caught by the next API call / heartbeat instead.
      };
    };
    connect();

    return () => {
      stopped = true;
      source?.close();
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, []);

  useEffect(() => {
    if (!evicted) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [evicted]);

  if (!evicted) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/50 backdrop-blur-[3px] transition-opacity duration-200',
        entered ? 'opacity-100' : 'opacity-0',
      )}
      role="alertdialog"
      aria-live="assertive"
    >
      <div
        className={cn(
          'w-full max-w-sm rounded-xl2 border border-line bg-card shadow-modal px-6 py-5 text-center transition-[opacity,transform] duration-200 ease-out',
          entered ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        )}
      >
        <SeatDots seats={['idle', 'active', 'free']} size="sm" className="justify-center mb-3" />
        <p className="font-display font-black text-ink">{he.evictedNotice}</p>
        <p className="text-sm text-muted mt-1 leading-relaxed">{he.evictedBody}</p>
      </div>
    </div>
  );
}
