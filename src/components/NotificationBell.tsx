'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { he } from '@/lib/he';
import { relativeHe } from '@/lib/relative-time';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationBell({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await apiFetch('/api/notifications');
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications);
      setUnread(data.unread);
    }
  }, []);

  // Initial fetch + poll every 60s.
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      await apiFetch('/api/notifications', { method: 'PATCH' });
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={he.notifications}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl text-muted hover:text-ink hover:bg-ink/5 transition-colors"
      >
        <span className="text-lg" aria-hidden>
          🔔
        </span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-4 h-4 px-1 rounded-full bg-copper-500 text-card text-[10px] font-bold flex items-center justify-center tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-80 max-w-[90vw] bg-card border border-line rounded-xl2 shadow-card z-50 overflow-hidden animate-rise">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
            <span className="font-semibold text-ink text-sm">{he.notifications}</span>
            <span className="text-xs text-muted">{he.markAllRead}</span>
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm text-muted text-center py-8 px-4">
              {he.notificationsEmpty}
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-line/70">
              {notifications.map((n) => {
                const unreadDot = !n.readAt;
                const inner = (
                  <div className="flex items-start gap-2.5 px-4 py-3">
                    <span
                      className={cn(
                        'mt-1.5 w-2 h-2 rounded-full shrink-0',
                        unreadDot ? 'bg-copper-500' : 'bg-transparent',
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink truncate">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-muted mt-0.5 line-clamp-2 leading-relaxed">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[11px] text-muted/70 mt-1">
                        {relativeHe(new Date(n.createdAt).getTime())}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} className="block hover:bg-paper/60 transition-colors">
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href={`/t/${slug}/notifications`}
            className="block text-center text-sm font-medium text-ink hover:bg-paper/60 px-4 py-3 border-t border-line transition-colors"
          >
            {he.viewAllNotifications}
          </Link>
        </div>
      )}
    </div>
  );
}
