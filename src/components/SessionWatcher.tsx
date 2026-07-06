'use client';

import { useEffect } from 'react';
import { loginPathFor } from '@/lib/client/api';

/**
 * Holds the SSE eviction channel. The moment this session is evicted (device
 * limit, admin kill, suspension) the server pushes `evicted` and we bounce to
 * login with a notice. Reconnects automatically while the session is alive.
 */
export default function SessionWatcher() {
  useEffect(() => {
    let source: EventSource | null = null;
    let stopped = false;

    const evicted = () => {
      if (stopped) return;
      stopped = true;
      source?.close();
      const login = loginPathFor(window.location.pathname);
      window.location.href = `${login}?evicted=1`;
    };

    const connect = () => {
      if (stopped) return;
      source = new EventSource('/api/auth/events');
      source.addEventListener('evicted', evicted);
      source.onerror = () => {
        // Network blip or server restart: EventSource retries by itself.
        // A dead session is caught by the next API call / heartbeat instead.
      };
    };
    connect();

    return () => {
      stopped = true;
      source?.close();
    };
  }, []);

  return null;
}
