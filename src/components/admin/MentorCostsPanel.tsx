'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import StatCard from '@/components/ui/StatCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';

interface CostRow {
  tenantId: string;
  name: string;
  slug: string;
  plan: string;
  budgetCents: number;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  exhausted: boolean;
}

interface CostsData {
  month: string;
  rows: CostRow[];
  totals: { costCents: number; messages: number; overBudget: number };
  topupLink: string;
}

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function MentorCostsPanel() {
  const [data, setData] = useState<CostsData | null>(null);
  const [topupLink, setTopupLink] = useState('');
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await apiFetch('/api/platform/mentor-costs');
    if (res.ok) {
      const d = (await res.json()) as CostsData;
      setData(d);
      setTopupLink(d.topupLink);
    } else setError(he.loadFailed);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (error && !data) return <p className="text-sm text-danger font-medium">{error}</p>;
  if (!data) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  async function saveTopup() {
    setError(null);
    const res = await apiFetch('/api/platform/mentor-costs', {
      method: 'PATCH',
      body: JSON.stringify({ topupLink: topupLink.trim() }),
    });
    if (res.ok) {
      setSavedFor('topup');
      setTimeout(() => setSavedFor(null), 1500);
    } else setError(he.error);
  }

  async function saveBudget(row: CostRow) {
    const draft = budgetDrafts[row.tenantId];
    const dollars = Number(draft);
    if (draft === undefined || Number.isNaN(dollars) || dollars < 0) return;
    setError(null);
    const res = await apiFetch(`/api/tenants/${row.tenantId}`, {
      method: 'PATCH',
      body: JSON.stringify({ mentorBudgetCents: Math.round(dollars * 100) }),
    });
    if (res.ok) {
      setSavedFor(row.tenantId);
      setTimeout(() => setSavedFor(null), 1500);
      reload();
    } else setError(he.error);
  }

  const active = data.rows.filter((r) => r.messages > 0);

  return (
    <div className="space-y-6">
      {/* Month totals */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label={`${he.saCostsTotal} · ${data.month}`} value={usd(data.totals.costCents)} />
        <StatCard label={he.saCostsMessages} value={data.totals.messages} />
        <StatCard
          label={he.saCostsOverBudget}
          value={data.totals.overBudget}
          accent={data.totals.overBudget > 0}
        />
      </div>

      {/* Top-up link */}
      <Card>
        <CardHeader title={he.saCostsTopupLink} subtitle={he.saCostsTopupHint} />
        <CardBody className="flex flex-wrap items-end gap-3">
          <Field label={he.saCostsTopupLink} className="flex-1 min-w-64">
            <Input
              dir="ltr"
              type="url"
              placeholder="https://pay.grow.link/..."
              value={topupLink}
              onChange={(e) => setTopupLink(e.target.value)}
            />
          </Field>
          <Button onClick={saveTopup}>{he.save}</Button>
          {savedFor === 'topup' && <span className="text-sm font-medium text-ok">{he.saved}</span>}
        </CardBody>
      </Card>

      {/* Per-school table */}
      {active.length === 0 ? (
        <EmptyState icon={<Icon name="chart" size={22} />} title={he.saCostsEmpty} hint={he.saCostsEmptyHint} />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{he.saCostsSchool}</Th>
                <Th>{he.saPlanLabel}</Th>
                <Th>{he.saCostsMsgs}</Th>
                <Th>{he.saCostsUsage}</Th>
                <Th>{he.saCostsCost}</Th>
                <Th>{he.saCostsBudget}</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {active.map((r) => {
                const pct = r.budgetCents > 0 ? Math.min(100, Math.round((r.costCents / r.budgetCents) * 100)) : 100;
                return (
                  <tr key={r.tenantId} className="hover:bg-paper/60 transition-colors">
                    <Td className="font-semibold">
                      {r.name}
                      <span className="text-xs text-muted font-normal ms-2" dir="ltr">
                        /t/{r.slug}
                      </span>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{r.plan}</Badge>
                    </Td>
                    <Td className="tabular-nums">{r.messages}</Td>
                    <Td>
                      <div className="w-28">
                        <div className="h-1.5 rounded-full bg-paper overflow-hidden">
                          <div
                            className={r.exhausted ? 'h-full bg-danger' : 'h-full bg-live'}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-muted tabular-nums mt-1">{pct}%</p>
                      </div>
                    </Td>
                    <Td className="tabular-nums font-semibold">
                      {usd(r.costCents)}
                      {r.exhausted && (
                        <Badge tone="danger" className="ms-2">
                          {he.saCostsOverBudget}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <Input
                        dir="ltr"
                        type="number"
                        min={0}
                        step="1"
                        className="!w-24 text-center"
                        value={budgetDrafts[r.tenantId] ?? String(r.budgetCents / 100)}
                        onChange={(e) =>
                          setBudgetDrafts((prev) => ({ ...prev, [r.tenantId]: e.target.value }))
                        }
                      />
                    </Td>
                    <Td>
                      <Button variant="secondary" size="sm" onClick={() => saveBudget(r)}>
                        {savedFor === r.tenantId ? he.saved : he.save}
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
      {error && <p className="text-sm text-danger font-medium">{error}</p>}
    </div>
  );
}
