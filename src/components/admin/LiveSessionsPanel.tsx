'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';

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

export default function LiveSessionsPanel() {
  const [sessions, setSessions] = useState<LiveSession[] | null>(null);

  const reload = useCallback(async () => {
    const res = await apiFetch('/api/sessions');
    if (res.ok) setSessions((await res.json()).sessions);
  }, []);

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 15_000);
    return () => clearInterval(interval);
  }, [reload]);

  if (!sessions) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="🌙"
        title={he.noLiveSessions}
        hint="הרשימה מתעדכנת אוטומטית כל 15 שניות"
      />
    );
  }

  async function kill(s: LiveSession) {
    await apiFetch(`/api/students/${s.userId}/sessions/${s.sid}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div className="space-y-3">
      <Badge tone="ok" dot>
        {sessions.length} {he.sessions}
      </Badge>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>{he.email}</Th>
              <Th>{he.device}</Th>
              <Th>{he.ipAddress}</Th>
              <Th>{he.connectedSince}</Th>
              <Th>{he.lastSeen}</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.sid} className="hover:bg-paper/60 transition-colors">
                <Td dir="ltr">{s.email}</Td>
                <Td>{s.deviceLabel || '—'}</Td>
                <Td className="text-muted tabular-nums" dir="ltr">
                  {s.ip}
                </Td>
                <Td className="text-muted tabular-nums" dir="ltr">
                  {new Date(s.createdAt).toLocaleString('he-IL')}
                </Td>
                <Td className="text-muted tabular-nums" dir="ltr">
                  {new Date(s.lastSeenAt).toLocaleTimeString('he-IL')}
                </Td>
                <Td className="text-end">
                  <Button variant="danger" size="sm" onClick={() => kill(s)}>
                    {he.killSession}
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
