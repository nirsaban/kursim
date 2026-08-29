'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';

type PlanKey = 'STARTER' | 'GROWTH' | 'UNLIMITED';

interface PkgRow {
  plan: PlanKey;
  priceMonthly: string;
  growLink: string;
  cap: number;
}

interface PaymentRow {
  id: string;
  createdAt: string;
  plan: string | null;
  amount: string;
  payerEmail: string;
  payerName: string;
  school: { name: string; slug: string } | null;
  totalForSchool: number;
}

const PLAN_LABEL: Record<PlanKey, string> = {
  STARTER: he.planStarter,
  GROWTH: he.planGrowth,
  UNLIMITED: he.planUnlimited,
};

export default function PlatformPackagesPanel() {
  const [rows, setRows] = useState<PkgRow[] | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/platform/packages')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setRows(d.packages);
          setWebhookUrl(d.webhookUrl ?? null);
        } else setError(he.loadFailed);
      })
      .catch(() => setError(he.loadFailed));
    apiFetch('/api/platform/plan-payments')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setPayments(d.payments);
      })
      .catch(() => {});
  }, []);

  function copyWebhook() {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (error && !rows) return <p className="text-sm text-danger font-medium">{error}</p>;
  if (!rows) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  function update(plan: PlanKey, patch: Partial<PkgRow>) {
    setRows((prev) => prev!.map((r) => (r.plan === plan ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  async function save() {
    if (!rows) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const body = Object.fromEntries(
      rows.map((r) => [r.plan, { price: r.priceMonthly, link: r.growLink }]),
    );
    const res = await apiFetch('/api/platform/packages', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      setRows((await res.json()).packages);
      setSaved(true);
    } else setError(he.saPackagesInvalid);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {rows.map((r) => (
          <Card key={r.plan}>
            <CardHeader
              title={PLAN_LABEL[r.plan]}
              subtitle={
                Number.isFinite(r.cap)
                  ? `${he.planUpTo} ${r.cap} ${he.planStudentsCap}`
                  : he.planNoCap
              }
            />
            <CardBody className="space-y-4">
              <Field label={he.saPackagePrice} hint={he.saPackagePriceHint}>
                <Input
                  value={r.priceMonthly}
                  onChange={(e) => update(r.plan, { priceMonthly: e.target.value })}
                  maxLength={20}
                  className="!w-32 text-center font-semibold"
                />
              </Field>
              <Field label={he.saPackageLink} hint={he.saPackageLinkHint}>
                <Input
                  dir="ltr"
                  type="url"
                  placeholder="https://pay.grow.link/..."
                  value={r.growLink}
                  onChange={(e) => update(r.plan, { growLink: e.target.value })}
                />
              </Field>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {he.save}
        </Button>
        {saved && <span className="text-sm font-medium text-ok">{he.saved}</span>}
        {error && <p className="text-sm text-danger font-medium">{error}</p>}
      </div>
      <p className="text-sm text-muted leading-relaxed">{he.saPackagesFlowNote}</p>

      {/* The one Grow server-callback URL for all package pages */}
      <Card>
        <CardHeader title={he.saWebhookTitle} subtitle={he.saWebhookHint} />
        <CardBody>
          {webhookUrl ? (
            <div className="flex flex-wrap items-center gap-3">
              <code
                dir="ltr"
                className="flex-1 min-w-64 text-xs bg-brand-50 border border-line rounded-xl px-3.5 py-2.5 overflow-x-auto whitespace-nowrap"
              >
                {webhookUrl}
              </code>
              <Button type="button" variant="secondary" size="sm" onClick={copyWebhook}>
                {copied ? he.saWebhookCopied : he.saWebhookCopy}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-danger font-medium">{he.saWebhookMissing}</p>
          )}
        </CardBody>
      </Card>

      {/* Payments received through the webhook (standing-order counter included) */}
      <Card>
        <CardHeader title={he.saPlanPaymentsTitle} />
        <CardBody>
          {payments.length === 0 ? (
            <p className="text-sm text-muted">{he.saPlanPaymentsEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-muted border-b border-line">
                    <th className="text-start font-medium py-2 pe-4">{he.saPlanPaymentsWhen}</th>
                    <th className="text-start font-medium py-2 pe-4">{he.saPlanPaymentsSchool}</th>
                    <th className="text-start font-medium py-2 pe-4">{he.saPlanPaymentsPlan}</th>
                    <th className="text-start font-medium py-2 pe-4">{he.saPlanPaymentsAmount}</th>
                    <th className="text-start font-medium py-2 pe-4">{he.saPlanPaymentsPayer}</th>
                    <th className="text-start font-medium py-2">{he.saPlanPaymentsCount}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="py-2.5 pe-4 whitespace-nowrap text-muted">
                        {new Date(p.createdAt).toLocaleDateString('he-IL')}
                      </td>
                      <td className="py-2.5 pe-4 font-medium">
                        {p.school ? (
                          p.school.name
                        ) : (
                          <span className="text-danger">{he.saPlanPaymentsUnmatched}</span>
                        )}
                      </td>
                      <td className="py-2.5 pe-4">
                        {p.plan ? PLAN_LABEL[p.plan as PlanKey] ?? p.plan : '—'}
                      </td>
                      <td className="py-2.5 pe-4 tabular-nums" dir="ltr">
                        {p.amount || '—'}
                      </td>
                      <td className="py-2.5 pe-4 text-muted" dir="ltr">
                        {p.payerEmail || p.payerName || '—'}
                      </td>
                      <td className="py-2.5 tabular-nums">
                        {p.school ? p.totalForSchool : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
