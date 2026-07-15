'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
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

export default function WhatsappConnect() {
  const [status, setStatus] = useState<Status>('unknown');
  const [phone, setPhone] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await apiFetch('/api/superadmin/whatsapp');
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
    await apiFetch('/api/superadmin/whatsapp', {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    setTimeout(refresh, 800);
  }

  const connected = status === 'connected';

  return (
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
  );
}
