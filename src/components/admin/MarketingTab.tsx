'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { CourseMarketing, emptyMarketing } from '@/lib/validation/marketing';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import {
  AccentPicker,
  EmojiPicker,
  PairListEditor,
  StringListEditor,
} from './MarketingFields';
import GalleryEditor from './GalleryEditor';
import ReviewsModeration from './ReviewsModeration';
import AffiliatesPanel from './AffiliatesPanel';

export default function MarketingTab({
  courseId,
  tenantSlug,
  courseTitle,
}: {
  courseId: string;
  tenantSlug: string;
  courseTitle: string;
}) {
  const [m, setM] = useState<CourseMarketing | null>(null);
  const [published, setPublished] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch(`/api/courses/${courseId}/marketing`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setM(d.marketing);
          setPublished(d.landingPublished);
        }
      });
  }, [courseId]);

  if (!m) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  const landingPath = `/t/${tenantSlug}/c/${courseId}`;
  const landingUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${landingPath}` : landingPath;

  const set = (patch: Partial<CourseMarketing>) => {
    setM({ ...m, ...patch });
    setSaved(false);
    setDirty(true);
  };

  async function save() {
    setBusy(true);
    const res = await apiFetch(`/api/courses/${courseId}/marketing`, {
      method: 'PUT',
      body: JSON.stringify(m),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      setDirty(false);
    }
  }

  async function togglePublish() {
    const res = await apiFetch(`/api/courses/${courseId}/landing`, {
      method: 'POST',
      body: JSON.stringify({ published: !published }),
    });
    if (res.ok) setPublished((await res.json()).landingPublished);
  }

  return (
    <div className="space-y-6">
      {/* Publish bar */}
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
        {published && (
          <p className="px-5 pb-4 text-xs text-muted -mt-2">{he.landingShareNote}</p>
        )}
      </Card>

      {/* Hero copy */}
      <Card>
        <CardHeader title={he.headline} subtitle="הכותרת שמקבלת את הפנים בדף הנחיתה" />
        <CardBody className="space-y-4">
          <Field label={he.headline}>
            <Input
              value={m.headline}
              placeholder={courseTitle}
              onChange={(e) => set({ headline: e.target.value })}
            />
          </Field>
          <Field label={he.subheadline}>
            <Textarea
              rows={2}
              value={m.subheadline}
              onChange={(e) => set({ subheadline: e.target.value })}
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={he.instructorName}>
              <Input
                value={m.instructorName}
                onChange={(e) => set({ instructorName: e.target.value })}
              />
            </Field>
            <Field label={he.priceText}>
              <Input value={m.priceText} onChange={(e) => set({ priceText: e.target.value })} />
            </Field>
          </div>
          <Field label={he.aboutSchool}>
            <Textarea
              rows={3}
              value={m.aboutSchool}
              onChange={(e) => set({ aboutSchool: e.target.value })}
            />
          </Field>
        </CardBody>
      </Card>

      {/* Audience & outcomes */}
      <Card>
        <CardHeader title={`${he.audienceTitle} · ${he.outcomesTitle}`} />
        <CardBody className="grid lg:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium mb-2">{he.audienceTitle}</p>
            <StringListEditor
              values={m.audience}
              onChange={(audience) => set({ audience })}
              placeholder={he.audienceItem}
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-2">{he.outcomesTitle}</p>
            <StringListEditor
              values={m.outcomes}
              onChange={(outcomes) => set({ outcomes })}
              placeholder={he.outcomeItem}
              max={8}
            />
          </div>
        </CardBody>
      </Card>

      {/* Benefits */}
      <Card>
        <CardHeader title={he.benefitsTitle} />
        <CardBody>
          <PairListEditor
            values={m.benefits}
            onChange={(benefits) => set({ benefits: benefits as CourseMarketing['benefits'] })}
            aKey="title"
            bKey="body"
            aPlaceholder={he.benefitTitle}
            bPlaceholder={he.benefitBody}
          />
        </CardBody>
      </Card>

      {/* Testimonials + FAQ */}
      <Card>
        <CardHeader title={`${he.testimonialsTitle} · ${he.faqTitle}`} />
        <CardBody className="grid lg:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium mb-2">{he.testimonialsTitle}</p>
            <PairListEditor
              values={m.testimonials}
              onChange={(testimonials) =>
                set({ testimonials: testimonials as CourseMarketing['testimonials'] })
              }
              aKey="name"
              bKey="quote"
              aPlaceholder={he.testimonialName}
              bPlaceholder={he.testimonialQuote}
              bMultiline
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-2">{he.faqTitle}</p>
            <PairListEditor
              values={m.faq}
              onChange={(faq) => set({ faq: faq as CourseMarketing['faq'] })}
              aKey="q"
              bKey="a"
              aPlaceholder={he.faqQ}
              bPlaceholder={he.faqA}
              bMultiline
              max={10}
            />
          </div>
        </CardBody>
      </Card>

      {/* Gallery */}
      <Card>
        <CardHeader title={he.gallerySection} subtitle={he.galleryTitle} />
        <CardBody>
          <GalleryEditor
            courseId={courseId}
            items={m.gallery}
            onChange={(gallery) => set({ gallery })}
          />
        </CardBody>
      </Card>

      {/* Student reviews moderation */}
      <Card>
        <CardHeader title={he.reviews} subtitle={he.reviewsTitle} />
        <CardBody>
          <ReviewsModeration courseId={courseId} />
        </CardBody>
      </Card>

      {/* Affiliates */}
      <Card>
        <CardHeader title={he.affiliatesSection} subtitle={he.affiliateTitle} />
        <CardBody>
          <AffiliatesPanel courseId={courseId} />
        </CardBody>
      </Card>

      {/* CTA + contact */}
      <Card>
        <CardHeader title={he.enrollNow} subtitle="לאן מגיעים לחיצה על כפתור ההרשמה" />
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
            <Input
              dir="ltr"
              value={m.contactPhone}
              onChange={(e) => set({ contactPhone: e.target.value })}
            />
          </Field>
          <Field label={he.contactEmail}>
            <Input
              dir="ltr"
              value={m.contactEmail}
              onChange={(e) => set({ contactEmail: e.target.value })}
            />
          </Field>
        </CardBody>
      </Card>

      {/* Style */}
      <Card>
        <CardHeader title={`${he.accentTitle} · ${he.emojiTitle}`} />
        <CardBody className="space-y-5">
          <AccentPicker value={m.accent} onChange={(accent) => set({ accent })} />
          <EmojiPicker value={m.emoji} onChange={(emoji) => set({ emoji })} />
        </CardBody>
      </Card>

      <div className="sticky bottom-4 flex items-center gap-3 bg-white/95 backdrop-blur border border-line rounded-xl2 shadow-lift px-5 py-3">
        <Button onClick={save} disabled={busy}>
          {he.save}
        </Button>
        {saved && <span className="text-sm font-medium text-ok">{he.saved} ✓</span>}
        {dirty && !busy && (
          <span className="text-sm font-medium text-warn">יש שינויים שלא נשמרו</span>
        )}
        <span className="ms-auto text-xs text-muted">{he.optionalStep}</span>
      </div>
    </div>
  );
}
