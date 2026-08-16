'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import type { Terms } from '@/lib/validation/branding';

export default function TermsSettings() {
  const [terms, setTerms] = useState<Terms | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/settings/terms')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTerms(d.terms))
      .catch(() => setError(he.loadFailed));
  }, []);

  if (error && !terms) return <p className="text-sm text-danger font-medium">{error}</p>;
  if (!terms) return <div className="h-48 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  async function save(next: Terms) {
    setBusy(true);
    setSaved(false);
    setError(null);
    const res = await apiFetch('/api/settings/terms', {
      method: 'PATCH',
      body: JSON.stringify(next),
    });
    setBusy(false);
    if (res.ok) {
      setTerms(next);
      setSaved(true);
    } else setError(he.error);
  }

  return (
    <Card>
      <CardHeader
        title={`${he.termsSettingsTitle} 📜`}
        subtitle={he.termsSettingsSubtitle}
        actions={
          <Badge tone={terms.enabled ? 'ok' : 'neutral'} dot={terms.enabled} pulse={terms.enabled}>
            {terms.enabled ? he.termsEnabledNote : he.termsDisabledNote}
          </Badge>
        }
      />
      <CardBody className="space-y-5">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={terms.enabled}
            onChange={(e) => setTerms({ ...terms, enabled: e.target.checked })}
            className="w-4 h-4 accent-copper-500"
          />
          <span className="text-sm font-medium text-ink">{he.termsEnable}</span>
        </label>

        <Field label={he.termsTitleLabel}>
          <Input
            value={terms.title}
            onChange={(e) => setTerms({ ...terms, title: e.target.value })}
            placeholder={he.termsDefaultTitle}
          />
        </Field>

        <Field label={he.termsBodyLabel} hint={he.termsBodyHint}>
          <Textarea
            rows={6}
            value={terms.body}
            onChange={(e) => setTerms({ ...terms, body: e.target.value })}
          />
        </Field>

        <Field label={he.termsUrlLabel}>
          <Input
            dir="ltr"
            type="url"
            value={terms.url}
            placeholder="https://..."
            onChange={(e) => setTerms({ ...terms, url: e.target.value })}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={busy} onClick={() => save(terms)}>
            {he.save}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            title={he.termsBumpVersionHint}
            onClick={() => save({ ...terms, version: terms.version + 1 })}
          >
            ✍️ {he.termsBumpVersion}
          </Button>
          {saved && <span className="text-sm font-medium text-ok">{he.saved} ✓</span>}
          {error && <p className="text-sm text-danger font-medium">{error}</p>}
        </div>
      </CardBody>
    </Card>
  );
}
