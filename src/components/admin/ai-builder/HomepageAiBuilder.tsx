'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { LANDING_THEMES } from '@/lib/landing-themes';
import type { TenantHomepage } from '@/lib/validation/homepage';
import AiBuilderWizard from './AiBuilderWizard';
import type { AiBuilderAnswers, HomepageAiDraft } from '@/lib/validation/ai-builder';

type Phase = 'wizard' | 'generating' | 'preview' | 'error';

/**
 * Lightweight content-only preview (hero band + about card) rather than the
 * real student home page — that page pulls in the student's own dashboard,
 * enrolled courses, achievements and catalog, none of which an unsaved draft
 * can reproduce client-side. The AI Builder only touches copy, so this is
 * enough to judge the writing and the accent color together.
 */
export default function HomepageAiBuilder({
  tenantName,
  currentHomepage,
  onApply,
  onConfirm,
  onClose,
}: {
  tenantName: string;
  currentHomepage: TenantHomepage;
  onApply: (patch: Partial<TenantHomepage>) => void;
  onConfirm: (homepage: TenantHomepage) => Promise<void>;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('wizard');
  const [draft, setDraft] = useState<HomepageAiDraft | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirming, setConfirming] = useState(false);

  async function generate(answers: AiBuilderAnswers) {
    setPhase('generating');
    const res = await apiFetch('/api/settings/homepage/ai-draft', {
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
    setDraft(d as HomepageAiDraft);
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

  const merged: TenantHomepage = draft
    ? {
        ...currentHomepage,
        welcomeHeadline: draft.welcomeHeadline,
        aboutSchool: draft.aboutSchool,
        emoji: draft.emoji,
        accent: draft.accent,
      }
    : currentHomepage;
  const theme = LANDING_THEMES[merged.accent];

  const applyDraft = () => {
    if (!draft) return;
    onApply({
      welcomeHeadline: draft.welcomeHeadline,
      aboutSchool: draft.aboutSchool,
      emoji: draft.emoji,
      accent: draft.accent,
    });
  };

  return (
    <Card>
      <CardHeader title={he.aiBuilderPreviewTitle} subtitle={he.aiBuilderPreviewHint} />
      <CardBody className="space-y-4">
        <div className="rounded-xl2 border border-line overflow-hidden p-5 bg-paper space-y-5">
          <section
            className="rounded-xl2 shadow-lift overflow-hidden"
            style={{ background: `linear-gradient(120deg, ${theme.deep}, ${theme.main})` }}
          >
            <div className="p-6 sm:p-8 text-white">
              <p className="text-white/70 text-sm font-medium">
                {he.greetingMorning} {merged.emoji}
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-black mt-1">
                {merged.welcomeHeadline || he.homeSubtitle}
              </h1>
            </div>
          </section>
          {merged.aboutSchool && (
            <div className="bg-card rounded-xl2 shadow-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: theme.soft }}
                >
                  {merged.emoji}
                </span>
                <h2 className="font-display font-bold text-lg">
                  {he.aboutSchoolTitle} — {tenantName}
                </h2>
              </div>
              <p className="text-sm text-muted leading-relaxed whitespace-pre-line">
                {merged.aboutSchool}
              </p>
            </div>
          )}
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
