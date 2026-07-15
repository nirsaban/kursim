'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { relativeHe } from '@/lib/relative-time';
import { he } from '@/lib/he';

type Status = 'pending' | 'qr' | 'connected' | 'disconnected' | 'logged_out' | 'unknown';

const STATUS_LABEL: Record<Status, string> = {
  pending: he.waStatusPending,
  qr: he.waStatusQr,
  connected: he.waStatusConnected,
  disconnected: he.waStatusDisconnected,
  logged_out: he.waStatusLoggedOut,
  unknown: he.waStatusDisconnected,
};

export interface WaMessageRow {
  id: string;
  toPhone: string;
  body: string;
  status: string;
  error: string | null;
  createdAt: string;
}

export default function WhatsappPanel({ messages }: { messages: WaMessageRow[] }) {
  const [status, setStatus] = useState<Status>('unknown');
  const [phone, setPhone] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await apiFetch('/api/whatsapp');
    if (res.ok) {
      const d = await res.json();
      setStatus(d.status ?? 'unknown');
      setPhone(d.phone ?? null);
      setQr(d.qr ?? null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  async function cmd(action: 'connect' | 'logout') {
    setBusy(true);
    await apiFetch('/api/whatsapp', { method: 'POST', body: JSON.stringify({ action }) });
    setBusy(false);
    setTimeout(refresh, 800);
  }

  const connected = status === 'connected';

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-center gap-3">
            <Badge tone={connected ? 'ok' : status === 'qr' ? 'warn' : 'neutral'} dot pulse={status === 'qr'}>
              {STATUS_LABEL[status]}
            </Badge>
            {connected && phone && (
              <span className="text-sm text-muted" dir="ltr">
                {he.waConnectedAs}: {phone}
              </span>
            )}
          </div>

          {connected ? (
            <p className="text-sm text-muted">{he.waConnectedNote}</p>
          ) : qr ? (
            <div className="text-center">
              <p className="text-sm text-muted mb-3">{he.waScanHint}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="WhatsApp QR" className="mx-auto w-56 h-56 rounded-xl border border-line bg-white p-2" />
            </div>
          ) : (
            <p className="text-sm text-muted">{he.waConnectHint}</p>
          )}

          <div className="flex gap-2">
            {!connected && (
              <Button onClick={() => cmd('connect')} disabled={busy}>
                {he.waConnect}
              </Button>
            )}
            {(connected || status === 'qr' || status === 'disconnected') && (
              <Button variant="danger" onClick={() => cmd('logout')} disabled={busy}>
                {he.waLogout}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={he.waMessageLog} />
        {messages.length === 0 ? (
          <EmptyState icon="💬" title={he.waNoMessages} />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{he.salePhoneLabel}</Th>
                  <Th>{he.waMessageBody}</Th>
                  <Th>{he.saleDelivered}</Th>
                  <Th>{he.announcementDate}</Th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id}>
                    <Td dir="ltr" className="font-mono text-xs">{m.toPhone}</Td>
                    <Td className="max-w-xs">
                      <span className="line-clamp-2 text-xs text-muted whitespace-pre-wrap">{m.body}</span>
                    </Td>
                    <Td>
                      {m.status === 'sent' ? (
                        <Badge tone="ok" dot>{he.waMsgSent}</Badge>
                      ) : m.status === 'failed' ? (
                        <span title={m.error ?? ''}>
                          <Badge tone="danger">{he.waMsgFailed}</Badge>
                        </span>
                      ) : (
                        <Badge tone="warn">{he.waMsgQueued}</Badge>
                      )}
                    </Td>
                    <Td className="text-xs text-muted">{relativeHe(new Date(m.createdAt).getTime())}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
