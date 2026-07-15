'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Input } from '@/components/ui/Field';
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

          {connected && <TestSendBlock defaultPhone={phone ?? ''} />}
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
                  <Th>{he.waResend}</Th>
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
                    <Td><MsgResendCell id={m.id} phone={m.toPhone} /></Td>
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

function TestSendBlock({ defaultPhone }: { defaultPhone: string }) {
  const [phone, setPhone] = useState(defaultPhone);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'sent' | 'queued' | 'failed' | null>(null);

  async function send() {
    if (!phone.trim() || busy) return;
    setBusy(true);
    setResult(null);
    const res = await apiFetch('/api/whatsapp/test', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      if (d.ok) setResult('sent');
      else if (typeof d.error === 'string' && d.error.startsWith('wa_')) setResult('queued');
      else setResult('failed');
    } else {
      setResult('failed');
    }
  }

  return (
    <div className="border-t border-line pt-4">
      <p className="text-sm font-semibold text-ink">{he.waTestTitle}</p>
      <p className="text-xs text-muted mt-0.5 mb-2.5">{he.waTestHint}</p>
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setResult(null);
          }}
          dir="ltr"
          aria-label={he.waTestPhoneLabel}
          className="!w-40 !py-1.5 font-mono text-sm"
        />
        <Button size="sm" variant="secondary" onClick={send} disabled={busy || !phone.trim()}>
          {he.waTestSend}
        </Button>
        {result === 'sent' && <span className="text-xs font-semibold text-ok">{he.waTestSent}</span>}
        {result === 'queued' && <span className="text-xs font-semibold text-warn">{he.waTestQueued}</span>}
        {result === 'failed' && <span className="text-xs font-semibold text-danger">{he.waTestFailed}</span>}
      </div>
    </div>
  );
}

function MsgResendCell({ id, phone }: { id: string; phone: string }) {
  const [value, setValue] = useState(phone);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'sent' | 'queued' | 'failed' | null>(null);

  async function resend() {
    if (!value.trim() || busy) return;
    setBusy(true);
    setResult(null);
    const res = await apiFetch(`/api/whatsapp/${id}/resend`, {
      method: 'POST',
      body: JSON.stringify({ phone: value }),
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      if (d.ok) setResult('sent');
      else if (typeof d.error === 'string' && d.error.startsWith('wa_')) setResult('queued');
      else setResult('failed');
    } else {
      setResult('failed');
    }
  }

  return (
    <div className="flex flex-col gap-1 min-w-36">
      <div className="flex gap-1.5">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setResult(null);
          }}
          dir="ltr"
          aria-label={he.salePhoneLabel}
          className="w-24 bg-card border border-line rounded-lg px-2 py-1 text-xs font-mono"
        />
        <Button size="sm" variant="ghost" onClick={resend} disabled={busy || !value.trim()}>
          {he.waResend}
        </Button>
      </div>
      {result === 'sent' && <span className="text-[11px] font-semibold text-ok">{he.waMsgSent} ✓</span>}
      {result === 'queued' && <span className="text-[11px] font-semibold text-warn">{he.waMsgQueued}</span>}
      {result === 'failed' && <span className="text-[11px] font-semibold text-danger">{he.waMsgFailed}</span>}
    </div>
  );
}
