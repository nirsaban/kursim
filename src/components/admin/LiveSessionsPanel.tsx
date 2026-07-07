'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import SeatDots, { SeatState } from '@/components/ui/SeatDots';
import { Input } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { relativeHe, isLiveNow } from '@/lib/relative-time';

interface LiveSession {
  sid: string;
  userId: string;
  email: string;
  role: string;
  deviceLabel: string;
  ip: string;
  createdAt: number;
  lastSeenAt: number;
}

interface StudentGroup {
  userId: string;
  email: string;
  sessions: LiveSession[];
}

export default function LiveSessionsPanel() {
  const [sessions, setSessions] = useState<LiveSession[] | null>(null);
  const [limit, setLimit] = useState(3);
  const [policy, setPolicy] = useState<'BLOCK' | 'EVICT_OLDEST'>('BLOCK');
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  const reload = useCallback(async () => {
    const res = await apiFetch('/api/sessions');
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions);
      if (data.limit) setLimit(data.limit);
      if (data.policy) setPolicy(data.policy);
      setRefreshedAt(Date.now());
    }
  }, []);

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 15_000);
    return () => clearInterval(interval);
  }, [reload]);

  const groups = useMemo(() => {
    if (!sessions) return [];
    const byUser = new Map<string, StudentGroup>();
    for (const s of sessions) {
      const g = byUser.get(s.userId) ?? { userId: s.userId, email: s.email, sessions: [] };
      g.sessions.push(s);
      byUser.set(s.userId, g);
    }
    const q = query.trim().toLowerCase();
    return [...byUser.values()]
      .filter((g) => !q || g.email.toLowerCase().includes(q))
      .sort((a, b) => {
        const aLimit = a.sessions.length >= limit ? 1 : 0;
        const bLimit = b.sessions.length >= limit ? 1 : 0;
        if (aLimit !== bLimit) return bLimit - aLimit;
        return (
          Math.max(...b.sessions.map((s) => s.lastSeenAt)) -
          Math.max(...a.sessions.map((s) => s.lastSeenAt))
        );
      });
  }, [sessions, query, limit]);

  if (!sessions) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  async function kill(s: LiveSession) {
    await apiFetch(`/api/students/${s.userId}/sessions/${s.sid}`, { method: 'DELETE' });
    reload();
  }

  const studentCount = new Set(sessions.map((s) => s.userId)).size;
  const policyLabel = policy === 'EVICT_OLDEST' ? he.policyEvictOldest : he.policyBlock;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="ok" dot pulse>
            {he.liveUpdate}
          </Badge>
          <span className="text-sm text-muted">
            {he.sessionsSummary
              .replace('{n}', String(sessions.length))
              .replace('{m}', String(studentCount))}{' '}
            · {he.policyPrefix} <b className="text-ink">{policyLabel}</b>,{' '}
            {he.upToDevices.replace('{n}', String(limit))}
          </span>
        </div>
        <div className="w-full sm:w-64">
          <Input
            placeholder={he.searchByEmail}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState title={he.noLiveSessions} hint={he.noLiveSessionsHint} />
      ) : (
        <div className="grid md:grid-cols-2 gap-4 items-start">
          {groups.map((g) => (
            <StudentCard key={g.userId} group={g} limit={limit} onKill={kill} />
          ))}
        </div>
      )}

      {refreshedAt && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="w-[7px] h-[7px] rounded-full bg-live animate-pulse-live" />
          {he.refreshedPrefix} {relativeHe(refreshedAt)}
        </div>
      )}
    </div>
  );
}

function StudentCard({
  group,
  limit,
  onKill,
}: {
  group: StudentGroup;
  limit: number;
  onKill: (s: LiveSession) => void;
}) {
  const atLimit = group.sessions.length >= limit;
  const distinctIps = new Set(group.sessions.map((s) => s.ip));
  const multiIp = distinctIps.size > 1;
  // The minority IP is the suspicious one — highlight everything that differs from the mode.
  const ipCounts = new Map<string, number>();
  for (const s of group.sessions) ipCounts.set(s.ip, (ipCounts.get(s.ip) ?? 0) + 1);
  const mainIp = [...ipCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const seats: SeatState[] = [
    ...group.sessions.map((s, i): SeatState => {
      const live = isLiveNow(s.lastSeenAt);
      if (atLimit) return live && i === 0 ? 'limit-active' : 'limit';
      return live ? 'active' : 'occupied';
    }),
    ...Array.from({ length: Math.max(0, limit - group.sessions.length) }, (): SeatState => 'free'),
  ];

  const initials = group.email.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        'bg-card rounded-[18px] p-5',
        atLimit
          ? 'border-[1.5px] border-warn-line shadow-[0_2px_10px_rgba(161,98,7,0.06)]'
          : 'border border-line',
      )}
    >
      <div className="flex items-center gap-3.5 mb-4">
        <div
          className={cn(
            'w-10 h-10 rounded-full grid place-items-center font-bold text-sm shrink-0',
            atLimit ? 'bg-ink text-paper' : 'bg-paper border border-line text-ink',
          )}
        >
          <span dir="ltr">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div dir="ltr" className="text-sm font-bold text-ink truncate text-start">
            {group.email}
          </div>
          {atLimit && (
            <div className="text-xs font-bold text-warn mt-0.5">
              <span dir="ltr">
                {group.sessions.length}/{limit}
              </span>{' '}
              · {he.atLimitBadge}
            </div>
          )}
        </div>
        <SeatDots seats={seats} size="sm" className="shrink-0" />
      </div>

      <div className="space-y-2">
        {group.sessions.map((s) => {
          const live = isLiveNow(s.lastSeenAt);
          return (
            <div
              key={s.sid}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-paper rounded-[11px] px-3.5 py-2.5 text-sm"
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  live ? 'bg-live animate-pulse-live' : 'bg-seat',
                )}
              />
              <span className="font-semibold text-ink flex-1 min-w-0 truncate">
                {s.deviceLabel || he.device}
              </span>
              <span
                dir="ltr"
                className={cn(
                  'font-mono text-xs tabular-nums',
                  multiIp && s.ip !== mainIp ? 'text-danger font-bold' : 'text-muted',
                )}
              >
                {s.ip}
              </span>
              <span className="text-xs text-muted">
                {he.connectedSince}{' '}
                <span dir="ltr" className="tabular-nums">
                  {new Date(s.createdAt).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
              <Button variant="danger" size="sm" onClick={() => onKill(s)}>
                {he.killSession}
              </Button>
            </div>
          );
        })}
      </div>

      {multiIp && (
        <div className="mt-3 text-xs text-warn bg-warn-soft rounded-[10px] px-3.5 py-2 leading-relaxed">
          ⚠ {he.multiIpWarning}
        </div>
      )}
    </div>
  );
}
