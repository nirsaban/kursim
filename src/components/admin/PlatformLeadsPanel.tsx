'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
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

function CalcomCard() {
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch('/api/platform/calcom')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setUrl(d.calcom.url);
          setSecret(d.calcom.secret);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    const res = await apiFetch('/api/platform/calcom', {
      method: 'PATCH',
      body: JSON.stringify({ url: url.trim(), secret: secret.trim() }),
    });
    setBusy(false);
    if (res.ok) setSaved(true);
    else setError(he.error);
  }

  const webhookUrl =
    typeof window === 'undefined' ? '/api/webhooks/calcom' : `${window.location.origin}/api/webhooks/calcom`;
  const active = Boolean(url.trim());

  if (!loaded) return <div className="h-40 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  return (
    <Card>
      <CardHeader
        title={he.saCalcomTitle}
        subtitle={he.saCalcomSubtitle}
        actions={
          <Badge tone={active ? 'ok' : 'neutral'} dot={active}>
            {active ? he.saCalcomActive : he.saCalcomInactive}
          </Badge>
        }
      />
      <CardBody className="space-y-4">
        <Field label={he.saCalcomUrl} hint={he.saCalcomUrlHint}>
          <Input
            dir="ltr"
            type="url"
            placeholder="https://cal.com/your-name/intro"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        <Field label={he.saCalcomSecret} hint={he.saCalcomSecretHint}>
          <Input
            dir="ltr"
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </Field>
        <div>
          <p className="text-sm font-medium text-ink mb-1.5">{he.saCalcomWebhookUrl}</p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="bg-paper border border-line rounded-lg px-3 py-2 text-xs break-all flex-1">
              {webhookUrl}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? he.copied : he.copy}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>
            {he.save}
          </Button>
          {saved && <span className="text-sm font-medium text-ok">{he.saved}</span>}
          {error && <p className="text-sm text-danger font-medium">{error}</p>}
        </div>
      </CardBody>
    </Card>
  );
}

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

      {/* Cal.com booking calendar */}
      <CalcomCard />

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
