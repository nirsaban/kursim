'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { he } from '@/lib/he';
import { CourseMarketing, emptyMarketing } from '@/lib/validation/marketing';
import Button from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import {
  AccentPicker,
  EmojiPicker,
  PairListEditor,
  StringListEditor,
} from './MarketingFields';
import LandingAiBuilder from './ai-builder/LandingAiBuilder';

const STEPS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: 'basics', label: he.stepBasics, required: true },
  { key: 'audience', label: he.stepAudience },
  { key: 'benefits', label: he.stepBenefits },
  { key: 'social', label: he.stepSocial },
  { key: 'pricing', label: he.stepPricing },
  { key: 'style', label: he.stepStyle },
];

export default function CourseWizard({ tenantSlug }: { tenantSlug: string }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [m, setM] = useState<CourseMarketing>(emptyMarketing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [showAiBuilder, setShowAiBuilder] = useState(false);

  const set = (patch: Partial<CourseMarketing>) => setM((prev) => ({ ...prev, ...patch }));
  const isLast = step === STEPS.length - 1;

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const courseRes = await apiFetch('/api/courses', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null }),
      });
      if (!courseRes.ok) throw new Error('create failed');
      const { course } = await courseRes.json();

      const cleaned: CourseMarketing = {
        ...m,
        audience: m.audience.filter((s) => s.trim()),
        outcomes: m.outcomes.filter((s) => s.trim()),
        benefits: m.benefits.filter((b) => b.title.trim()),
        testimonials: m.testimonials.filter((t) => t.name.trim() && t.quote.trim()),
        faq: m.faq.filter((f) => f.q.trim() && f.a.trim()),
      };
      const mRes = await apiFetch(`/api/courses/${course.id}/marketing`, {
        method: 'PUT',
        body: JSON.stringify(cleaned),
      });
      if (!mRes.ok) throw new Error('marketing failed');
      setCreatedId(course.id);
    } catch {
      setError(he.error);
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish() {
    if (!createdId) return;
    const res = await apiFetch(`/api/courses/${createdId}/landing`, {
      method: 'POST',
      body: JSON.stringify({ published: !published }),
    });
    if (res.ok) setPublished((await res.json()).landingPublished);
  }

  /* ---- done screen ---- */
  if (createdId) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-ok/10 text-3xl flex items-center justify-center mx-auto mb-5">
          {m.emoji}
        </div>
        <h1 className="font-display text-3xl font-bold">{he.wizardDone}</h1>
        <p className="text-muted mt-2">{he.wizardDoneHint}</p>

        <Card className="mt-8 text-start">
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{he.landingPage}</p>
                <p className="text-xs text-muted mt-0.5">{he.landingShareNote}</p>
              </div>
              <Button variant={published ? 'secondary' : 'cta'} size="sm" onClick={togglePublish}>
                {published ? he.landingUnpublish : he.landingPublish}
              </Button>
            </div>
            <code
              dir="ltr"
              className="block text-xs bg-paper border border-line rounded-lg px-3 py-2 truncate"
            >
              {typeof window !== 'undefined' ? window.location.origin : ''}/t/{tenantSlug}/c/
              {createdId}
            </code>
          </CardBody>
        </Card>

        <div className="flex justify-center gap-3 mt-8">
          <Link
            href={`/t/${tenantSlug}/admin/courses/${createdId}`}
            className="inline-flex items-center bg-brand-700 hover:bg-brand-800 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
          >
            {he.goToCourse}
          </Link>
          <a
            href={`/t/${tenantSlug}/c/${createdId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center bg-card border border-line hover:border-brand-300 font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
          >
            {he.landingPreview} ↗
          </a>
        </div>
      </div>
    );
  }

  /* ---- wizard ---- */
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <p className="kicker mb-1">{he.wizardKicker}</p>
        <h1 className="font-display text-3xl font-bold">{he.newCourseWizard}</h1>
        <p className="text-muted mt-2">{he.wizardIntro}</p>
      </div>

      {/* Step indicator */}
      <ol className="flex items-center justify-center gap-1.5 mb-8" aria-label={he.wizardStepsAria}>
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                i === step
                  ? 'bg-brand-700 text-white'
                  : i < step
                    ? 'bg-brand-100 text-brand-800 hover:bg-brand-200'
                    : 'bg-ink/5 text-muted',
              )}
              aria-current={i === step ? 'step' : undefined}
            >
              {i < step ? '✓' : i + 1}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="w-3 h-px bg-line hidden sm:block" />}
          </li>
        ))}
      </ol>

      <Card>
        <CardBody className="space-y-5">
          {step === 0 && (
            <>
              <Field label={he.courseTitle}>
                <Input
                  autoFocus
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={he.courseTitlePlaceholder}
                />
              </Field>
              <Field label={he.courseDescription} hint={he.courseTitleHint}>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>

              {title.trim() &&
                (showAiBuilder ? (
                  <LandingAiBuilder
                    tenantSlug={tenantSlug}
                    courseTitle={title.trim()}
                    courseDescription={description.trim()}
                    currentMarketing={m}
                    onApply={set}
                    onClose={() => setShowAiBuilder(false)}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-4 border border-line rounded-xl2 px-4 py-3 bg-paper/50">
                    <div>
                      <p className="font-semibold text-sm">{he.aiBuilderTitle}</p>
                      <p className="text-xs text-muted mt-0.5">{he.aiBuilderSubtitle}</p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setShowAiBuilder(true)}>
                      {he.aiBuilderOpen}
                    </Button>
                  </div>
                ))}

              <Field label={he.headline} hint={he.headlineHint}>
                <Input
                  value={m.headline}
                  placeholder={title}
                  onChange={(e) => set({ headline: e.target.value })}
                />
              </Field>
              <Field label={he.subheadline}>
                <Textarea
                  rows={2}
                  value={m.subheadline}
                  placeholder={he.subheadlinePlaceholder}
                  onChange={(e) => set({ subheadline: e.target.value })}
                />
              </Field>
              <Field label={he.instructorName}>
                <Input
                  value={m.instructorName}
                  onChange={(e) => set({ instructorName: e.target.value })}
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <p className="font-semibold mb-1">{he.audienceTitle}</p>
                <p className="text-xs text-muted mb-3">{he.optionalStep}</p>
                <StringListEditor
                  values={m.audience}
                  onChange={(audience) => set({ audience })}
                  placeholder={he.audienceItem}
                />
              </div>
              <div className="pt-2 border-t border-line">
                <p className="font-semibold mb-3 mt-3">{he.outcomesTitle}</p>
                <StringListEditor
                  values={m.outcomes}
                  onChange={(outcomes) => set({ outcomes })}
                  placeholder={he.outcomeItem}
                  max={8}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <div>
              <p className="font-semibold mb-1">{he.benefitsTitle}</p>
              <p className="text-xs text-muted mb-3">{he.optionalStep}</p>
              <PairListEditor
                values={m.benefits}
                onChange={(benefits) => set({ benefits: benefits as CourseMarketing['benefits'] })}
                aKey="title"
                bKey="body"
                aPlaceholder={he.benefitTitle}
                bPlaceholder={he.benefitBody}
              />
            </div>
          )}

          {step === 3 && (
            <>
              <div>
                <p className="font-semibold mb-1">{he.testimonialsTitle}</p>
                <p className="text-xs text-muted mb-3">{he.optionalStep}</p>
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
              <div className="pt-2 border-t border-line">
                <p className="font-semibold mb-3 mt-3">{he.faqTitle}</p>
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
            </>
          )}

          {step === 4 && (
            <>
              <Field label={he.priceText}>
                <Input value={m.priceText} onChange={(e) => set({ priceText: e.target.value })} />
              </Field>
              <Field label={he.paymentLink} hint={he.paymentLinkHint}>
                <Input
                  dir="ltr"
                  value={m.paymentLink}
                  placeholder="https://pay.example.com/..."
                  onChange={(e) => set({ paymentLink: e.target.value })}
                />
              </Field>
              <Field label={he.ctaText}>
                <Input
                  value={m.ctaText}
                  placeholder={he.enrollNow}
                  onChange={(e) => set({ ctaText: e.target.value })}
                />
              </Field>
              <Field label={he.ctaLink} hint={he.ctaLinkHint}>
                <Input
                  dir="ltr"
                  value={m.ctaLink}
                  placeholder="https://wa.me/972..."
                  onChange={(e) => set({ ctaLink: e.target.value })}
                />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
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
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div>
                <p className="font-semibold mb-3">{he.accentTitle}</p>
                <AccentPicker value={m.accent} onChange={(accent) => set({ accent })} />
              </div>
              <div>
                <p className="font-semibold mb-3">{he.emojiTitle}</p>
                <EmojiPicker value={m.emoji} onChange={(emoji) => set({ emoji })} />
              </div>
              <Field label={he.aboutSchool}>
                <Textarea
                  rows={3}
                  value={m.aboutSchool}
                  placeholder={he.aboutSchoolPlaceholder}
                  onChange={(e) => set({ aboutSchool: e.target.value })}
                />
              </Field>
              <p className="text-xs text-muted">💡 {he.galleryAfterCreate}</p>
            </>
          )}

          {error && <p className="text-sm text-danger font-medium">{error}</p>}
        </CardBody>
      </Card>

      <div className="flex items-center justify-between mt-6">
        <div>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              → {he.back}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!STEPS[step].required && !isLast && (
            <Button variant="ghost" onClick={() => setStep(step + 1)}>
              {he.skip}
            </Button>
          )}
          {isLast ? (
            <Button onClick={finish} disabled={busy || !title.trim()} size="lg">
              {he.finish} ✓
            </Button>
          ) : (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={STEPS[step].required && !title.trim()}
            >
              {he.next} ←
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
