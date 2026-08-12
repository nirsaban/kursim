'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { CourseMarketing } from '@/lib/validation/marketing';
import { useEditableResource } from '@/lib/client/useEditableResource';
import { agorotToInput, inputToAgorot } from '@/lib/money';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import SaveBar from '@/components/admin/SaveBar';

type SiblingCourse = { id: string; title: string };

export default function PublishSection({
  courseId,
  tenantSlug,
}: {
  courseId: string;
  tenantSlug: string;
}) {
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);
  // Price lives on the Course row, not in marketing JSON, so it saves through
  // its own endpoint rather than the SaveBar below.
  const [price, setPrice] = useState('');
  const [priceSaved, setPriceSaved] = useState(false);
  const [siblings, setSiblings] = useState<SiblingCourse[]>([]);
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

  // The course's own price, and the other courses that can be bundled with it.
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await apiFetch('/api/courses');
      if (!r.ok || !alive) return;
      const { courses } = (await r.json()) as {
        courses: Array<{ id: string; title: string; priceAgorot: number | null }>;
      };
      if (!alive) return;
      setSiblings(courses.filter((c) => c.id !== courseId).map((c) => ({ id: c.id, title: c.title })));
      setPrice(agorotToInput(courses.find((c) => c.id === courseId)?.priceAgorot));
    })();
    return () => {
      alive = false;
    };
  }, [courseId]);

  async function savePrice() {
    const r = await apiFetch(`/api/courses/${courseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ priceAgorot: inputToAgorot(price) }),
    });
    if (r.ok) {
      setPriceSaved(true);
      setTimeout(() => setPriceSaved(false), 2000);
    }
  }

  if (!m) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  const bundleIds = m.bundleCourseIds;
  const toggleBundle = (id: string) =>
    set({
      bundleCourseIds: bundleIds.includes(id)
        ? bundleIds.filter((x) => x !== id)
        : [...bundleIds, id],
    });

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
        <CardHeader title={he.coursePrice} subtitle={he.paymentsHypNote} />
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <Field label={he.coursePrice} hint={he.coursePriceHint} className="flex-1 min-w-44">
              <div className="flex items-center gap-2">
                <Input
                  dir="ltr"
                  inputMode="decimal"
                  value={price}
                  placeholder="349"
                  onChange={(e) => setPrice(e.target.value)}
                  onBlur={savePrice}
                />
                <span className="text-lg font-bold text-muted">{he.coursePriceCurrency}</span>
              </div>
            </Field>
            <Button variant="secondary" size="sm" className="mb-1" onClick={savePrice}>
              {priceSaved ? he.coursePriceSaved : he.save}
            </Button>
          </div>
          {!inputToAgorot(price) && <p className="text-xs text-muted -mt-2">{he.coursePriceEmpty}</p>}

          <div>
            <p className="text-sm font-medium text-ink">{he.courseBundleTitle}</p>
            <p className="text-xs text-muted mt-1 mb-2.5">{he.courseBundleHint}</p>
            {siblings.length === 0 ? (
              <p className="text-xs text-muted">{he.courseBundleNone}</p>
            ) : (
              <div className="space-y-2">
                {siblings.map((c) => (
                  <label key={c.id} className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bundleIds.includes(c.id)}
                      onChange={() => toggleBundle(c.id)}
                      className="size-4 accent-copper-500"
                    />
                    <span>{c.title}</span>
                  </label>
                ))}
              </div>
            )}
            {bundleIds.length > 0 && (
              <p className="text-xs text-muted mt-2.5">
                {he.courseBundleSummary.replace('{n}', String(bundleIds.length + 1))}
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={he.enrollNow} subtitle={he.ctaLinkSubtitle} />
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
