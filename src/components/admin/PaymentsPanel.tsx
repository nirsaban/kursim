'use client';

import { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { relativeHe } from '@/lib/relative-time';
import { he } from '@/lib/he';

export interface PaymentCourse {
  id: string;
  title: string;
  hasPaymentLink: boolean;
  webhookUrl: string;
}
export interface PurchaseRow {
  id: string;
  payerName: string;
  payerEmail: string;
  courseTitle: string;
  amount: string;
  delivered: boolean;
  isNewUser: boolean;
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
          </ol>
        </CardBody>
      </Card>

      {/* Per-course webhook URLs */}
      <div className="space-y-3">
        {courses.map((c) => (
          <div key={c.id} className="bg-card border border-line rounded-xl2 shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-display font-bold">{c.title}</span>
              {!c.hasPaymentLink && (
                <Badge tone="warn" className="ms-auto">
                  {he.noPaymentLinkYet}
                </Badge>
              )}
            </div>
            <WebhookRow url={c.webhookUrl} />
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

function WebhookRow({ url }: { url: string }) {
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
      <p className="text-xs font-medium text-muted mb-1">{he.webhookUrlLabel}</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          dir="ltr"
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 bg-paper border border-line rounded-xl px-3 py-2 text-xs font-mono text-ink truncate"
        />
        <button
          onClick={copy}
          className="shrink-0 text-sm font-semibold bg-ink text-card rounded-xl px-4 py-2 hover:bg-ink-surface transition-colors"
        >
          {copied ? he.copied : he.copyWebhookUrl}
        </button>
      </div>
    </div>
  );
}
