'use client';

import { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { apiFetch } from '@/lib/client/api';
import { relativeHe } from '@/lib/relative-time';
import { he } from '@/lib/he';

export interface PaymentCourse {
  id: string;
  title: string;
  hasPaymentLink: boolean;
  webhookUrl: string;
  thankYouUrl: string;
}
export interface PurchaseRow {
  id: string;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  courseTitle: string;
  amount: string;
  delivered: boolean;
  isNewUser: boolean;
  canResend: boolean;
  createdAt: string;
}

export default function PaymentsPanel({
  courses,
  whatsappOn,
  purchases,
}: {
  courses: PaymentCourse[];
  whatsappOn: boolean;
  purchases: PurchaseRow[];
}) {
  return (
    <div className="space-y-6">
      {/* How-to + WhatsApp status */}
      <Card>
        <CardHeader
          title={he.paymentsHowTitle}
          actions={
            <Badge tone={whatsappOn ? 'ok' : 'warn'} dot>
              {he.whatsappStatus}: {whatsappOn ? he.whatsappOn : he.whatsappOff}
            </Badge>
          }
        />
        <CardBody>
          <ol className="space-y-1.5 text-sm text-muted list-decimal ps-5">
            <li>{he.paymentsHowStep1}</li>
            <li>{he.paymentsHowStep2}</li>
            <li>{he.paymentsHowStep3}</li>
            <li>{he.paymentsHowStep4}</li>
          </ol>
        </CardBody>
      </Card>

      {/* Per-course webhook URLs */}
      <div className="space-y-3">
        {courses.map((c) => (
          <div key={c.id} className="bg-card border border-line rounded-xl2 shadow-card p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-display font-bold min-w-0">{c.title}</span>
              {!c.hasPaymentLink && (
                <Badge tone="warn" className="ms-auto">
                  {he.noPaymentLinkYet}
                </Badge>
              )}
            </div>
            <div className="space-y-3">
              <CopyRow label={he.webhookUrlLabel} url={c.webhookUrl} copyLabel={he.copyWebhookUrl} />
              <CopyRow label={he.thankYouUrlLabel} url={c.thankYouUrl} copyLabel={he.copyThankYouUrl} />
            </div>
          </div>
        ))}
      </div>

      {/* Recent sales */}
      <div>
        <h2 className="font-display text-xl font-bold mb-3">{he.recentSales}</h2>
        {purchases.length === 0 ? (
          <EmptyState icon="🧾" title={he.noSalesYet} />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{he.salePayer}</Th>
                  <Th>{he.saleCourseCol}</Th>
                  <Th>{he.saleAmount}</Th>
                  <Th>{he.saleDelivered}</Th>
                  <Th>{he.resendWa}</Th>
                  <Th>{he.announcementDate}</Th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <span className="font-semibold">{p.payerName || p.payerEmail.split('@')[0]}</span>
                      <span className="block text-xs text-muted" dir="ltr">{p.payerEmail}</span>
                      {p.isNewUser && <Badge tone="copper" className="mt-1">{he.saleNewAccount}</Badge>}
                    </Td>
                    <Td>{p.courseTitle}</Td>
                    <Td dir="ltr">{p.amount}</Td>
                    <Td>
                      {p.delivered ? (
                        <Badge tone="ok" dot>{he.whatsappOn}</Badge>
                      ) : (
                        <Badge tone="neutral">—</Badge>
                      )}
                    </Td>
                    <Td>{p.canResend ? <ResendCell id={p.id} phone={p.payerPhone} /> : <span className="text-muted">—</span>}</Td>
                    <Td className="text-xs text-muted">{relativeHe(new Date(p.createdAt).getTime())}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </div>
    </div>
  );
}

function ResendCell({ id, phone }: { id: string; phone: string }) {
  const [value, setValue] = useState(phone);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'sent' | 'queued' | 'failed' | null>(null);

  async function resend() {
    setBusy(true);
    setResult(null);
    const res = await apiFetch(`/api/purchases/${id}/resend`, {
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
    <div className="flex flex-col gap-1.5 min-w-40">
      <div className="flex gap-1.5">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setResult(null);
          }}
          dir="ltr"
          aria-label={he.salePhoneLabel}
          className="w-28 bg-card border border-line rounded-lg px-2 py-1 text-xs font-mono"
        />
        <Button size="sm" variant="secondary" onClick={resend} disabled={busy || !value.trim()}>
          {he.resendWa}
        </Button>
      </div>
      {result === 'sent' && <span className="text-xs font-semibold text-ok">{he.resendSent}</span>}
      {result === 'queued' && <span className="text-xs font-semibold text-warn">{he.resendQueued}</span>}
      {result === 'failed' && <span className="text-xs font-semibold text-danger">{he.resendFailed}</span>}
    </div>
  );
}

function CopyRow({ label, url, copyLabel }: { label: string; url: string; copyLabel: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — the input is selectable as a fallback
    }
  }
  return (
    <div>
      <p className="text-xs font-medium text-muted mb-1">{label}</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          dir="ltr"
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 bg-paper border border-line rounded-xl px-3 py-2 text-xs font-mono text-ink truncate"
        />
        <button
          onClick={copy}
          className="shrink-0 text-sm font-semibold bg-ink text-card rounded-xl px-4 py-2 hover:bg-ink-surface transition-colors"
        >
          {copied ? he.copied : copyLabel}
        </button>
      </div>
    </div>
  );
}
