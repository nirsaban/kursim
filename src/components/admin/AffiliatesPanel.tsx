'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import EmptyState from '@/components/ui/EmptyState';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';

interface Affiliate {
  id: string;
  email: string;
  code: string;
  visits: number;
  coins: number;
  createdAt: string;
}

/** Owner view of course affiliates: who shares, how many unique visitors, coins earned. */
export default function AffiliatesPanel({ courseId }: { courseId: string }) {
  const [affiliates, setAffiliates] = useState<Affiliate[] | null>(null);
  const [perCoin, setPerCoin] = useState(100);

  useEffect(() => {
    apiFetch(`/api/courses/${courseId}/affiliates`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setAffiliates(d.affiliates);
          setPerCoin(d.visitsPerCoin);
        }
      });
  }, [courseId]);

  if (!affiliates) return <div className="h-24 rounded-xl bg-ink/[0.04] animate-pulse" />;
  if (affiliates.length === 0) {
    return <EmptyState icon="🪙" title={he.none} hint={he.affiliatesEmpty} />;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {he.affiliateHint.replace('{n}', String(perCoin))}
      </p>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>{he.email}</Th>
              <Th>{he.affiliateVisits}</Th>
              <Th>{he.affiliateCoins}</Th>
              <Th>ref</Th>
            </tr>
          </thead>
          <tbody>
            {affiliates.map((a) => (
              <tr key={a.id} className="hover:bg-paper/60 transition-colors">
                <Td dir="ltr">{a.email}</Td>
                <Td className="tabular-nums">{a.visits}</Td>
                <Td className="tabular-nums font-semibold text-warn">🪙 {a.coins}</Td>
                <Td dir="ltr" className="text-xs text-muted">
                  {a.code}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
