'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { CourseMarketing } from '@/lib/validation/marketing';
import { useEditableResource } from '@/lib/client/useEditableResource';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import SaveBar from '@/components/admin/SaveBar';

export default function PublishSection({
  courseId,
  tenantSlug,
}: {
  courseId: string;
  tenantSlug: string;
}) {
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);
  const { value: m, set, save, saved, dirty, busy } = useEditableResource<CourseMarketing>({
    load: async () => {
      const r = await apiFetch(`/api/courses/${courseId}/marketing`);
      if (!r.ok) return null;
      const d = await r.json();
      setPublished(d.landingPublished);
      return d.marketing;
    },
    save: async (toSave) => {
      const r = await apiFetch(`/api/courses/${courseId}/marketing`, {
        method: 'PUT',
        body: JSON.stringify(toSave),
      });
      return r.ok;
    },
  });

  if (!m) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  const landingPath = `/t/${tenantSlug}/c/${courseId}`;
  const landingUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${landingPath}` : landingPath;

  async function togglePublish() {
    const res = await apiFetch(`/api/courses/${courseId}/landing`, {
      method: 'POST',
      body: JSON.stringify({ published: !published }),
    });
    if (res.ok) setPublished((await res.json()).landingPublished);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          {published ? (
            <Badge tone="ok" dot>
              {he.landingPublished}
            </Badge>
          ) : (
            <Badge tone="neutral">{he.landingDraftBadge}</Badge>
          )}
          <div className="flex-1 min-w-40">
            <code
              dir="ltr"
              className="block text-xs bg-paper border border-line rounded-lg px-3 py-2 truncate"
            >
              {landingUrl}
            </code>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(landingUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? he.copied : he.copy}
          </Button>
          <a
            href={landingPath}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            {he.landingPreview} ↗
          </a>
          <Button variant={published ? 'secondary' : 'cta'} size="sm" onClick={togglePublish}>
            {published ? he.landingUnpublish : he.landingPublish}
          </Button>
        </CardBody>
        {published && <p className="px-5 pb-4 text-xs text-muted -mt-2">{he.landingShareNote}</p>}
      </Card>

      <Card>
        <CardHeader title={he.enrollNow} subtitle={he.ctaLinkSubtitle} />
        <CardBody className="grid sm:grid-cols-2 gap-4">
          <Field label={he.paymentLink} hint={he.paymentLinkHint} className="sm:col-span-2">
            <Input
              dir="ltr"
              value={m.paymentLink}
              placeholder="https://pay.example.com/..."
              onChange={(e) => set({ paymentLink: e.target.value })}
            />
          </Field>
          <Field label={he.ctaText}>
            <Input value={m.ctaText} onChange={(e) => set({ ctaText: e.target.value })} />
          </Field>
          <Field label={he.ctaLink}>
            <Input
              dir="ltr"
              value={m.ctaLink}
              placeholder="https://wa.me/972..."
              onChange={(e) => set({ ctaLink: e.target.value })}
            />
          </Field>
          <Field label={he.contactPhone}>
            <Input dir="ltr" value={m.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
          </Field>
          <Field label={he.contactEmail}>
            <Input dir="ltr" value={m.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
          </Field>
        </CardBody>
      </Card>

      <SaveBar busy={busy} saved={saved} dirty={dirty} onSave={() => save()} />
    </div>
  );
}
