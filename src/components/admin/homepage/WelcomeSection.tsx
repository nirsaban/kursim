'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { TenantHomepage } from '@/lib/validation/homepage';
import { useEditableResource } from '@/lib/client/useEditableResource';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import HomepageAiBuilder from '@/components/admin/ai-builder/HomepageAiBuilder';
import SaveBar from '@/components/admin/SaveBar';

export default function WelcomeSection({ slug }: { slug: string }) {
  const [showAiBuilder, setShowAiBuilder] = useState(false);
  const { value: hp, set, save, saved, dirty, busy, error } = useEditableResource<TenantHomepage>({
    load: async () => {
      const res = await apiFetch('/api/settings/homepage');
      return res.ok ? (await res.json()).homepage : null;
    },
    save: async (toSave) => {
      // Drop rows the owner added but never titled — the schema requires a title.
      const payload = { ...toSave, announcements: toSave.announcements.filter((a) => a.title.trim()) };
      const res = await apiFetch('/api/settings/homepage', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return res.ok;
    },
  });

  if (!hp) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  if (showAiBuilder) {
    return (
      <HomepageAiBuilder
        tenantName={slug}
        currentHomepage={hp}
        onApply={set}
        onConfirm={async (toSave) => {
          await save(toSave);
        }}
        onClose={() => setShowAiBuilder(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex items-center flex-wrap justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold">{he.aiBuilderTitle}</p>
            <p className="text-sm text-muted mt-0.5">{he.aiBuilderSubtitle}</p>
          </div>
          <Button variant="secondary" className="shrink-0" onClick={() => setShowAiBuilder(true)}>
            {he.aiBuilderOpen}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={he.homepageWelcome} subtitle={he.homepageAboutSchoolHint} />
        <CardBody className="space-y-4">
          <Field label={he.homepageWelcomeHeadline}>
            <Input
              value={hp.welcomeHeadline}
              placeholder={he.homepageWelcomeHeadlinePlaceholder}
              onChange={(e) => set({ welcomeHeadline: e.target.value })}
            />
          </Field>
          <Field label={he.homepageAboutSchool}>
            <Textarea
              rows={4}
              value={hp.aboutSchool}
              onChange={(e) => set({ aboutSchool: e.target.value })}
            />
          </Field>
        </CardBody>
      </Card>

      <SaveBar busy={busy} saved={saved} dirty={dirty} error={error} onSave={() => save()} />
    </div>
  );
}
