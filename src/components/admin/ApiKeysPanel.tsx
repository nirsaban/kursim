'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { relativeHe } from '@/lib/relative-time';

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface CourseRow {
  id: string;
  title: string;
}

export default function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [name, setName] = useState('');
  const [minted, setMinted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copiedWhat, setCopiedWhat] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [kRes, cRes] = await Promise.all([apiFetch('/api/api-keys'), apiFetch('/api/courses')]);
    if (kRes.ok) setKeys((await kRes.json()).keys);
    if (cRes.ok) {
      const list = (await cRes.json()).courses as Array<{ id: string; title: string }>;
      setCourses(list.map((c) => ({ id: c.id, title: c.title })));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiFetch('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (res.ok) {
      setMinted((await res.json()).plaintext);
      setName('');
      reload();
    } else setError(he.error);
  }

  async function removeKey(id: string) {
    if (!confirm(he.confirmDelete)) return;
    await apiFetch(`/api/api-keys/${id}`, { method: 'DELETE' });
    reload();
  }

  function copy(what: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedWhat(what);
    setTimeout(() => setCopiedWhat(null), 1500);
  }

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const courseIds = useMemo(() => [...selected], [selected]);
  const keyPlaceholder = minted ?? 'YOUR_API_KEY';

  const curlSnippet = useMemo(
    () =>
      [
        `curl -X POST ${origin}/api/v1/automation \\`,
        `  -H "Authorization: Bearer ${keyPlaceholder}" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -d '{`,
        `    "email": "customer@email.com",`,
        `    "full_name": "שם הלקוח",`,
        `    "course_ids": ${JSON.stringify(courseIds)},`,
        `    "action": "enroll"`,
        `  }'`,
      ].join('\n'),
    [origin, keyPlaceholder, courseIds],
  );

  const makeSnippet = useMemo(
    () =>
      JSON.stringify(
        {
          url: `${origin}/api/v1/automation`,
          method: 'POST',
          headers: [
            { name: 'Authorization', value: `Bearer ${keyPlaceholder}` },
            { name: 'Content-Type', value: 'application/json' },
          ],
          body: {
            email: '{{email}}',
            full_name: '{{name}}',
            course_ids: courseIds,
            action: 'enroll',
          },
        },
        null,
        2,
      ),
    [origin, keyPlaceholder, courseIds],
  );

  if (!keys) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={he.apiKeysTitle} subtitle={he.apiKeysSubtitle} />
        <CardBody className="space-y-5">
          <form onSubmit={createKey} className="flex flex-wrap items-end gap-3">
            <Field label={he.apiKeyName} className="flex-1 min-w-56">
              <Input
                value={name}
                placeholder={he.apiKeyNamePlaceholder}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" disabled={busy || !name.trim()}>
              + {he.apiKeyCreate}
            </Button>
            {error && <p className="text-sm text-danger font-medium">{error}</p>}
          </form>

          {minted && (
            <div className="bg-warn-soft border border-warn-line rounded-xl2 p-4 space-y-2">
              <p className="text-sm font-semibold text-warn">{he.apiKeyMintedNote}</p>
              <div className="flex items-center gap-2">
                <code dir="ltr" className="bg-card border border-warn-line rounded-lg px-3 py-2 text-xs break-all flex-1">
                  {minted}
                </code>
                <Button variant="secondary" size="sm" onClick={() => copy('key', minted)}>
                  {copiedWhat === 'key' ? he.copied : he.copy}
                </Button>
              </div>
            </div>
          )}

          {keys.length === 0 ? (
            <EmptyState icon="🔑" title={he.apiKeysEmpty} hint={he.apiKeysEmptyHint} />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>{he.apiKeyName}</Th>
                    <Th>{he.apiKeyPrefix}</Th>
                    <Th>{he.apiKeyCreatedAt}</Th>
                    <Th>{he.apiKeyLastUsed}</Th>
                    <Th> </Th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id}>
                      <Td className="font-medium">{k.name}</Td>
                      <Td dir="ltr" className="font-mono text-xs">
                        {k.prefix}…
                      </Td>
                      <Td className="text-muted">{relativeHe(new Date(k.createdAt).getTime())}</Td>
                      <Td className="text-muted">
                        {k.lastUsedAt ? relativeHe(new Date(k.lastUsedAt).getTime()) : '—'}
                      </Td>
                      <Td>
                        <Button variant="ghost" size="sm" onClick={() => removeKey(k.id)}>
                          🗑
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={he.apiSnippetTitle} subtitle={he.apiSnippetSubtitle} />
        <CardBody className="space-y-5">
          {courses.length === 0 ? (
            <p className="text-sm text-muted">{he.apiSnippetNoCourses}</p>
          ) : (
            <fieldset>
              <legend className="text-sm font-medium mb-2">{he.apiSnippetPickCourses}</legend>
              <div className="flex flex-wrap gap-2">
                {courses.map((c) => {
                  const on = selected.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const next = new Set(selected);
                        if (on) next.delete(c.id);
                        else next.add(c.id);
                        setSelected(next);
                      }}
                      className={
                        on
                          ? 'text-sm font-semibold rounded-full px-4 py-2 bg-ink text-paper'
                          : 'text-sm font-semibold rounded-full px-4 py-2 bg-card border border-line hover:border-brand-300'
                      }
                    >
                      {c.title}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-ink">cURL</p>
              <Button variant="secondary" size="sm" onClick={() => copy('curl', curlSnippet)}>
                {copiedWhat === 'curl' ? he.copied : he.copy}
              </Button>
            </div>
            <pre dir="ltr" className="bg-ink text-paper/90 rounded-xl2 p-4 text-xs overflow-x-auto leading-relaxed">
              {curlSnippet}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-ink">Make.com / Zapier</p>
              <Button variant="secondary" size="sm" onClick={() => copy('make', makeSnippet)}>
                {copiedWhat === 'make' ? he.copied : he.copy}
              </Button>
            </div>
            <pre dir="ltr" className="bg-ink text-paper/90 rounded-xl2 p-4 text-xs overflow-x-auto leading-relaxed">
              {makeSnippet}
            </pre>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
