'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { LANDING_THEMES } from '@/lib/landing-themes';
import type { CourseMarketing } from '@/lib/validation/marketing';
import type { LandingProps } from '@/components/landing/landing-types';
import ClassicLanding from '@/components/landing/ClassicLanding';
import CoralHotaLanding from '@/components/landing/coralhota/CoralHotaLanding';
import AiBuilderWizard from './AiBuilderWizard';
import type { AiBuilderAnswers, LandingAiDraft } from '@/lib/validation/ai-builder';

/** Builds a full LandingProps preview from a (possibly draft-merged) marketing object.
 * Gallery/reviews/curriculum are intentionally empty — the AI Builder only touches copy. */
function buildPreviewProps(m: CourseMarketing, tenantSlug: string, courseTitle: string): LandingProps {
  const theme = LANDING_THEMES[m.accent];
  const headline = m.headline || courseTitle;
  const ctaHref = m.paymentLink || m.ctaLink || `/t/${tenantSlug}/login`;
  const ctaText = m.ctaText || (m.paymentLink ? he.payNow : he.enrollNow);
  const cta = (extra = '') => (
    <a
      href={ctaHref}
      className={`inline-flex items-center justify-center gap-2.5 font-bold text-[17px] rounded-full px-9 py-4 text-card transition-transform hover:scale-[1.03] active:scale-[0.99] ${extra}`}
      style={{ background: theme.main }}
      onClick={(e) => e.preventDefault()}
    >
      {ctaText}
    </a>
  );
  return {
    slug: tenantSlug,
    tenantName: tenantSlug,
    sessionLimit: 3,
    modules: [],
    m,
    theme,
    previewMode: true,
    headline,
    ctaHref,
    ctaText,
    ctaExternal: false,
    externalProps: {},
    cta,
    trustBullets: [he.trustInstantAccess, he.trustLifetime, he.trustAnyDevice],
    lessonCount: 0,
    reviews: [],
    enrollCount: 0,
    gallery: [],
    galleryRest: [],
    heroMedia: null,
    totalHours: null,
    avgRating: null,
    cinematic: null,
    showSale: false,
    salePartner: null,
    salePartnerCoverUrl: null,
    saleHref: '#',
    saleExternalProps: {},
  };
}

type Phase = 'wizard' | 'generating' | 'preview' | 'error';

export default function LandingAiBuilder({
  courseId,
  tenantSlug,
  courseTitle,
  currentMarketing,
  onApply,
  onConfirm,
  onClose,
}: {
  courseId: string;
  tenantSlug: string;
  courseTitle: string;
  currentMarketing: CourseMarketing;
  onApply: (patch: Partial<CourseMarketing>) => void;
  /** Saves the exact object passed in — avoids relying on React state having
   * flushed onApply's patch before the save request is built. */
  onConfirm: (marketing: CourseMarketing) => Promise<void>;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('wizard');
  const [draft, setDraft] = useState<LandingAiDraft | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirming, setConfirming] = useState(false);

  async function generate(answers: AiBuilderAnswers) {
    setPhase('generating');
    const res = await apiFetch(`/api/courses/${courseId}/ai-draft`, {
      method: 'POST',
      body: JSON.stringify(answers),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErrorMsg(d.error === 'ai_disabled' ? he.aiBuilderDisabled : he.aiBuilderFailed);
      setPhase('error');
      return;
    }
    const { draft: d } = await res.json();
    setDraft(d as LandingAiDraft);
    setPhase('preview');
  }

  if (phase === 'wizard' || phase === 'generating') {
    return (
      <Card>
        <CardHeader title={he.aiBuilderTitle} subtitle={he.aiBuilderSubtitle} />
        <CardBody>
          <AiBuilderWizard onSubmit={generate} busy={phase === 'generating'} onCancel={onClose} />
        </CardBody>
      </Card>
    );
  }

  if (phase === 'error') {
    return (
      <Card>
        <CardHeader title={he.aiBuilderTitle} />
        <CardBody className="space-y-3">
          <p className="text-sm font-medium text-danger">{errorMsg}</p>
          <div className="flex gap-3">
            <Button size="sm" onClick={() => setPhase('wizard')}>
              {he.aiBuilderStartOver}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              {he.cancel}
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // preview
  const merged: CourseMarketing = draft
    ? {
        ...currentMarketing,
        headline: draft.headline,
        subheadline: draft.subheadline,
        aboutSchool: draft.aboutSchool,
        audience: draft.audience,
        outcomes: draft.outcomes,
        benefits: draft.benefits,
        faq: draft.faq,
        ctaText: draft.ctaText,
        emoji: draft.emoji,
        accent: draft.accent,
        layout: draft.layout,
      }
    : currentMarketing;
  const previewProps = buildPreviewProps(merged, tenantSlug, courseTitle);
  const Template = merged.layout === 'coralHota' ? CoralHotaLanding : ClassicLanding;

  const applyDraft = () => {
    if (!draft) return;
    onApply({
      headline: draft.headline,
      subheadline: draft.subheadline,
      aboutSchool: draft.aboutSchool,
      audience: draft.audience,
      outcomes: draft.outcomes,
      benefits: draft.benefits,
      faq: draft.faq,
      ctaText: draft.ctaText,
      emoji: draft.emoji,
      accent: draft.accent,
      layout: draft.layout,
    });
  };

  return (
    <Card>
      <CardHeader title={he.aiBuilderPreviewTitle} subtitle={he.aiBuilderPreviewHint} />
      <CardBody className="space-y-4">
        <div className="rounded-xl2 border border-line overflow-hidden max-h-[70vh] overflow-y-auto">
          <Template {...previewProps} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            size="sm"
            disabled={confirming}
            onClick={async () => {
              setConfirming(true);
              applyDraft();
              await onConfirm(merged);
              setConfirming(false);
              onClose();
            }}
          >
            {he.aiBuilderConfirm}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              applyDraft();
              onClose();
            }}
          >
            {he.aiBuilderEditFirst}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPhase('wizard')}>
            {he.aiBuilderStartOver}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
