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

const PLAN_LABEL: Record<PlanKey, string> = {
  STARTER: he.planStarter,
  GROWTH: he.planGrowth,
  UNLIMITED: he.planUnlimited,
};

export default function PlatformPackagesPanel() {
  const [rows, setRows] = useState<PkgRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/platform/packages')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setRows(d.packages);
        else setError(he.loadFailed);
      })
      .catch(() => setError(he.loadFailed));
  }, []);

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
    </div>
  );
}
