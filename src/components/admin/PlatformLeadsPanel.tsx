'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { relativeHe } from '@/lib/relative-time';

interface LeadRow {
  id: string;
  name: string;
  contact: string;
  phone: string | null;
  message: string;
  status: 'new' | 'greeted' | 'scheduled' | 'closed';
  appointmentAt: string | null;
  createdAt: string;
}

type WaStatus = 'pending' | 'qr' | 'connected' | 'disconnected' | 'logged_out' | 'unknown';

const STATUS_LABEL: Record<LeadRow['status'], string> = {
  new: he.saLeadStatusNew,
  greeted: he.saLeadStatusGreeted,
  scheduled: he.saLeadStatusScheduled,
  closed: he.saLeadStatusClosed,
};

const STATUS_TONE: Record<LeadRow['status'], 'neutral' | 'warn' | 'ok' | 'copper'> = {
  new: 'neutral',
  greeted: 'warn',
  scheduled: 'ok',
  closed: 'copper',
};

const appointmentFmt = new Intl.DateTimeFormat('he-IL', {
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jerusalem',
});

export default function PlatformLeadsPanel() {
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [waStatus, setWaStatus] = useState<WaStatus>('unknown');
  const [waPhone, setWaPhone] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [lRes, wRes] = await Promise.all([
      apiFetch('/api/platform/leads'),
      apiFetch('/api/platform/whatsapp'),
    ]);
    if (lRes.ok) setLeads((await lRes.json()).leads);
    if (wRes.ok) {
      const d = await wRes.json();
      setWaStatus(d.state?.status ?? 'unknown');
      setWaPhone(d.state?.phone ?? null);
      setQr(d.qr ?? null);
    }
  }, []);

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 5000);
    return () => clearInterval(interval);
  }, [reload]);

  async function cmd(action: 'connect' | 'logout') {
    await apiFetch('/api/platform/whatsapp', {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    setTimeout(reload, 1500);
  }

  const connected = waStatus === 'connected';

  return (
    <div className="space-y-6">
      {/* Platform WhatsApp pairing */}
      <Card>
        <CardHeader
          title={he.saWaTitle}
          subtitle={he.saWaSubtitle}
          actions={
            <Badge tone={connected ? 'ok' : waStatus === 'qr' ? 'warn' : 'neutral'} dot pulse={waStatus === 'qr'}>
              {connected ? `${he.waStatusConnected}${waPhone ? ` · ${waPhone}` : ''}` : waStatus === 'qr' ? he.waStatusQr : he.waStatusDisconnected}
            </Badge>
          }
        />
        <CardBody className="flex flex-wrap items-center gap-5">
          {waStatus === 'qr' && qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR" className="w-44 h-44 rounded-xl border border-line" />
          )}
          <div className="flex gap-2">
            {!connected && (
              <Button onClick={() => cmd('connect')}>{he.waConnect}</Button>
            )}
            {connected && (
              <Button variant="ghost" onClick={() => cmd('logout')}>
                {he.waLogout}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Leads table */}
      {leads === null ? (
        <div className="h-48 rounded-xl2 bg-ink/[0.04] animate-pulse" />
      ) : leads.length === 0 ? (
        <EmptyState icon={<Icon name="chat" size={22} />} title={he.saLeadsEmpty} hint={he.saLeadsEmptyHint} />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{he.saLeadName}</Th>
                <Th>{he.saLeadContact}</Th>
                <Th>{he.saLeadStatus}</Th>
                <Th>{he.saLeadAppointment}</Th>
                <Th>{he.saLeadCreated}</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-paper/60 transition-colors">
                  <Td className="font-semibold">
                    {l.name || <span className="text-muted">—</span>}
                    {l.message && (
                      <p className="text-xs text-muted font-normal mt-0.5 max-w-56 truncate">{l.message}</p>
                    )}
                  </Td>
                  <Td dir="ltr">{l.phone ?? l.contact}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[l.status]} dot={l.status === 'scheduled'}>
                      {STATUS_LABEL[l.status]}
                    </Badge>
                  </Td>
                  <Td className="tabular-nums">
                    {l.appointmentAt ? appointmentFmt.format(new Date(l.appointmentAt)) : '—'}
                  </Td>
                  <Td className="text-muted">{relativeHe(new Date(l.createdAt).getTime())}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
