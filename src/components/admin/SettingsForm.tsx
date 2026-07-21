'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/cn';

interface Settings {
  name: string;
  sessionLimit: number;
  evictionPolicy: 'BLOCK' | 'EVICT_OLDEST';
}

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    apiFetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setSettings(d.settings);
        else setLoadFailed(true);
      })
      .catch(() => setLoadFailed(true));
  }, []);

  if (loadFailed) return <p className="text-sm text-danger font-medium">{he.loadFailed}</p>;
  if (!settings) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setBusy(true);
    setSaved(false);
    setError(null);
    const res = await apiFetch('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
    setBusy(false);
    if (res.ok) setSaved(true);
    else setError(he.error);
  }

  const policies = [
    {
      value: 'BLOCK' as const,
      title: he.policyBlock,
      hint: he.policyBlockHint,
      icon: '🚫',
    },
    {
      value: 'EVICT_OLDEST' as const,
      title: he.policyEvictOldest,
      hint: he.policyEvictOldestHint,
      icon: '🔄',
    },
  ];

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader title={he.tenantName} />
        <CardBody>
          <Field label={he.tenantName}>
            <Input
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              required
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={he.sessionLimit}
          subtitle={he.sessionLimitSubtitle}
        />
        <CardBody className="space-y-5">
          <Field label={he.sessionLimit}>
            <Input
              type="number"
              min={1}
              max={20}
              className="!w-28 text-center"
              value={settings.sessionLimit}
              onChange={(e) => setSettings({ ...settings, sessionLimit: Number(e.target.value) })}
            />
          </Field>

          <fieldset>
            <legend className="text-sm font-medium mb-3">{he.evictionPolicy}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {policies.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setSettings({ ...settings, evictionPolicy: p.value })}
                  className={cn(
                    'text-start border rounded-xl2 p-4 transition-all',
                    settings.evictionPolicy === p.value
                      ? 'border-brand-600 bg-brand-50 shadow-card'
                      : 'border-line hover:border-brand-300',
                  )}
                  aria-pressed={settings.evictionPolicy === p.value}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <span aria-hidden>{p.icon}</span> {p.title}
                  </div>
                  <p className="text-xs text-muted mt-1.5 leading-relaxed">{p.hint}</p>
                </button>
              ))}
            </div>
          </fieldset>
        </CardBody>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {he.save}
        </Button>
        {saved && <span className="text-sm font-medium text-ok">{he.saved} ✓</span>}
        {error && <p className="text-sm text-danger font-medium">{error}</p>}
      </div>
    </form>
  );
}
