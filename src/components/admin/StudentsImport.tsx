'use client';

import { useMemo, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { Field, Textarea } from '@/components/ui/Field';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';

interface RowResult {
  email: string;
  status: 'created' | 'exists' | 'error';
  password?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** `email,name` per line (name optional; a header line is skipped). */
function parseCsv(text: string): Array<{ email: string; name: string }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [email = '', ...rest] = line.split(',');
      return { email: email.trim().toLowerCase(), name: rest.join(',').trim() };
    })
    .filter((r) => EMAIL_RE.test(r.email));
}

export default function StudentsImport({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RowResult[] | null>(null);

  const rows = useMemo(() => parseCsv(text), [text]);

  function close() {
    setOpen(false);
    setText('');
    setResults(null);
    setError(null);
  }

  async function submit() {
    if (rows.length === 0) return;
    setBusy(true);
    setError(null);
    const res = await apiFetch('/api/students/import', {
      method: 'POST',
      body: JSON.stringify({ rows: rows.slice(0, 500) }),
    });
    setBusy(false);
    if (res.ok) {
      setResults((await res.json()).results);
      onDone();
    } else {
      setError(he.error);
    }
  }

  const created = results?.filter((r) => r.status === 'created') ?? [];

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        📋 {he.importCsv}
      </Button>

      <Modal open={open} onClose={close} title={he.importCsvTitle}>
        {results === null ? (
          <div className="space-y-4">
            <Field label={he.importCsvLabel} hint={he.importCsvHint}>
              <Textarea
                dir="ltr"
                rows={8}
                className="font-mono text-xs"
                placeholder={'student@example.com,שם התלמיד\nother@example.com'}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </Field>
            <div className="flex items-center gap-3">
              <Button onClick={submit} disabled={busy || rows.length === 0}>
                {busy ? he.importing : `${he.importAction} (${rows.length})`}
              </Button>
              {error && <p className="text-sm text-danger font-medium">{error}</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {he.importDone} — {created.length} {he.importCreated}
              {created.length > 0 && ` · ${he.importPasswordsNote}`}
            </p>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>{he.email}</Th>
                    <Th>{he.status}</Th>
                    <Th>{he.password}</Th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.email}>
                      <Td dir="ltr">{r.email}</Td>
                      <Td>
                        {r.status === 'created' && <Badge tone="ok">{he.importStatusCreated}</Badge>}
                        {r.status === 'exists' && <Badge tone="warn">{he.importStatusExists}</Badge>}
                        {r.status === 'error' && <Badge tone="danger">{he.error}</Badge>}
                      </Td>
                      <Td dir="ltr" className="font-mono text-xs">
                        {r.password ?? '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            {created.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  navigator.clipboard.writeText(
                    created.map((r) => `${r.email}\t${r.password ?? ''}`).join('\n'),
                  )
                }
              >
                {he.importCopyPasswords}
              </Button>
            )}
            <div>
              <Button onClick={close}>{he.close}</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
