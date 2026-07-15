'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';

interface Course {
  id: string;
  title: string;
}

interface AccessCode {
  id: string;
  code: string;
  courseId: string;
  courseTitle: string | null;
  maxUses: number;
  uses: number;
  expiresAt: string | null;
  createdAt: string;
}

export default function AccessCodesPanel({
  courses,
  initialCodes,
}: {
  courses: Course[];
  initialCodes: AccessCode[];
}) {
  const [codes, setCodes] = useState<AccessCode[]>(initialCodes);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AccessCode | null>(null);
  const [copied, setCopied] = useState(false);

  function isExpired(c: AccessCode): boolean {
    return !!c.expiresAt && new Date(c.expiresAt) < new Date();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!courseId) return;
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { courseId, maxUses };
    const days = parseInt(expiresInDays, 10);
    if (expiresInDays !== '' && !Number.isNaN(days)) body.expiresInDays = days;

    const res = await apiFetch('/api/access-codes', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      const code: AccessCode = data.code;
      setCodes((prev) => [code, ...prev]);
      setCreated(code);
      setCopied(false);
      setMaxUses(1);
      setExpiresInDays('');
    } else {
      setError(he.error);
    }
  }

  function copyCode(value: string) {
    navigator.clipboard.writeText(value);
    setCopied(true);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={he.newAccessCode} />
        <CardBody>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
            <Field label={he.accessCodeCourse}>
              <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={he.accessCodeMaxUses}>
              <Input
                type="number"
                min={1}
                dir="ltr"
                value={maxUses}
                onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value)))}
              />
            </Field>
            <Field label={he.accessCodeExpiry}>
              <Input
                type="number"
                min={1}
                dir="ltr"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
              />
            </Field>
            <div className="sm:col-span-3 flex items-center gap-3">
              <Button type="submit" disabled={busy || !courseId}>
                {he.accessCodeCreate}
              </Button>
              {error && <p className="text-sm text-danger font-medium">{error}</p>}
            </div>
          </form>
        </CardBody>
      </Card>

      {created && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl2 p-4 space-y-2">
          <div className="flex items-center gap-3">
            <code
              dir="ltr"
              className="bg-card border border-brand-200 rounded-lg px-4 py-2 text-lg font-bold tracking-widest flex-1 text-center"
            >
              {created.code}
            </code>
            <Button variant="secondary" size="sm" onClick={() => copyCode(created.code)}>
              {copied ? he.codeCopied : he.copy}
            </Button>
          </div>
        </div>
      )}

      {codes.length === 0 ? (
        <EmptyState icon="🎟️" title={he.accessCodesEmpty} />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{he.newAccessCode}</Th>
                <Th>{he.accessCodeCourse}</Th>
                <Th>{he.accessCodeUses}</Th>
                <Th>{he.accessCodeExpiry}</Th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const expired = isExpired(c);
                return (
                  <tr key={c.id} className="hover:bg-paper/60 transition-colors">
                    <Td>
                      <div className="flex items-center gap-2">
                        <code dir="ltr" className="font-bold tracking-widest">
                          {c.code}
                        </code>
                        <button
                          onClick={() => copyCode(c.code)}
                          className="text-xs font-medium text-brand-700 hover:underline"
                        >
                          {he.copy}
                        </button>
                        {expired && <Badge tone="danger">{he.accessCodeExpired}</Badge>}
                      </div>
                    </Td>
                    <Td>{c.courseTitle ?? '—'}</Td>
                    <Td className="tabular-nums" dir="ltr">
                      {c.uses}/{c.maxUses}
                    </Td>
                    <Td className="text-muted tabular-nums" dir="ltr">
                      {c.expiresAt
                        ? new Date(c.expiresAt).toLocaleDateString('he-IL')
                        : '—'}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
