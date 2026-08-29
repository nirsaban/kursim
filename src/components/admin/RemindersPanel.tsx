'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { cn } from '@/lib/cn';

interface Automation {
  id: string;
  name: string;
  trigger: 'WELCOME' | 'INACTIVITY';
  days: number;
  subject: string;
  body: string;
  active: boolean;
  sentCount: number;
}

type Draft = Omit<Automation, 'id' | 'sentCount'>;

const EMPTY_DRAFT: Draft = {
  name: '',
  trigger: 'WELCOME',
  days: 3,
  subject: '',
  body: '',
  active: true,
};

export default function RemindersPanel() {
  const [automations, setAutomations] = useState<Automation[] | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await apiFetch('/api/automations');
      if (res.ok) setAutomations((await res.json()).automations);
      else setLoadFailed(true);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loadFailed) return <p className="text-sm text-danger font-medium">{he.loadFailed}</p>;
  if (!automations) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const res = editing.id
      ? await apiFetch(`/api/automations/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(editing.draft),
        })
      : await apiFetch('/api/automations', {
          method: 'POST',
          body: JSON.stringify(editing.draft),
        });
    setBusy(false);
    if (res.ok) {
      setEditing(null);
      reload();
    } else setError(he.error);
  }

  async function toggle(a: Automation) {
    await apiFetch(`/api/automations/${a.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !a.active }),
    });
    reload();
  }

  async function remove(id: string) {
    if (!confirm(he.confirmDelete)) return;
    await apiFetch(`/api/automations/${id}`, { method: 'DELETE' });
    reload();
  }

  const triggerLabel = (a: Automation) =>
    a.trigger === 'WELCOME'
      ? he.automationTriggerWelcome
      : he.automationTriggerInactivity.replace('{days}', String(a.days));

  return (
    <div className="space-y-6">
      <div>
        <Button onClick={() => setEditing({ id: null, draft: EMPTY_DRAFT })}>
          + {he.automationNew}
        </Button>
      </div>

      {automations.length === 0 ? (
        <EmptyState
          icon="⏰"
          title={he.automationsEmpty}
          hint={he.automationsEmptyHint}
          action={
            <Button onClick={() => setEditing({ id: null, draft: EMPTY_DRAFT })}>
              + {he.automationNew}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {automations.map((a) => (
            <Card key={a.id} className={cn('p-4 sm:p-5', !a.active && 'opacity-60')}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-11 h-11 rounded-xl bg-brand-50 grid place-items-center text-xl shrink-0">
                  {a.trigger === 'WELCOME' ? '👋' : '⏰'}
                </span>
                <div className="flex-1 min-w-48">
                  <p className="font-display font-bold text-ink">{a.name}</p>
                  <p className="text-sm text-muted">
                    {triggerLabel(a)} · ✉️ {a.subject}
                  </p>
                </div>
                <Badge tone="neutral">
                  {a.sentCount} {he.automationSent}
                </Badge>
                {/* Active toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={a.active}
                  aria-label={he.automationActive}
                  onClick={() => toggle(a)}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors shrink-0',
                    a.active ? 'bg-live' : 'bg-seat',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-card shadow transition-transform',
                      a.active && 'translate-x-[-20px] rtl:translate-x-[-20px]',
                    )}
                  />
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setEditing({
                      id: a.id,
                      draft: {
                        name: a.name,
                        trigger: a.trigger,
                        days: a.days,
                        subject: a.subject,
                        body: a.body,
                        active: a.active,
                      },
                    })
                  }
                >
                  {he.edit}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(a.id)}>
                  🗑
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? he.automationEdit : he.automationNew}
        wide
      >
        {editing && (
          <div className="space-y-4">
            <Field label={he.automationName}>
              <Input
                value={editing.draft.name}
                placeholder={he.automationNamePlaceholder}
                onChange={(e) =>
                  setEditing({ ...editing, draft: { ...editing.draft, name: e.target.value } })
                }
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={he.automationTrigger}>
                <Select
                  value={editing.draft.trigger}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      draft: { ...editing.draft, trigger: e.target.value as Draft['trigger'] },
                    })
                  }
                >
                  <option value="WELCOME">{he.automationTriggerWelcomeOption}</option>
                  <option value="INACTIVITY">{he.automationTriggerInactivityOption}</option>
                </Select>
              </Field>
              {editing.draft.trigger === 'INACTIVITY' && (
                <Field label={he.automationDays}>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={editing.draft.days}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        draft: { ...editing.draft, days: Number(e.target.value) },
                      })
                    }
                  />
                </Field>
              )}
            </div>

            <Field label={he.automationSubject}>
              <Input
                value={editing.draft.subject}
                onChange={(e) =>
                  setEditing({ ...editing, draft: { ...editing.draft, subject: e.target.value } })
                }
              />
            </Field>

            <Field label={he.automationBody} hint={he.automationVarsHint}>
              <Textarea
                rows={6}
                value={editing.draft.body}
                onChange={(e) =>
                  setEditing({ ...editing, draft: { ...editing.draft, body: e.target.value } })
                }
              />
            </Field>

            <div className="flex items-center gap-3">
              <Button
                onClick={save}
                disabled={
                  busy ||
                  !editing.draft.name.trim() ||
                  !editing.draft.subject.trim() ||
                  !editing.draft.body.trim()
                }
              >
                {he.save}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                {he.cancel}
              </Button>
              {error && <p className="text-sm text-danger font-medium">{error}</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
