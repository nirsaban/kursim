'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { he } from '@/lib/he';
import { Field, Textarea } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import {
  AI_BUILDER_GOALS,
  AI_BUILDER_TONES,
  AI_BUILDER_CREATIVITY,
  type AiBuilderAnswers,
  type AiBuilderGoal,
  type AiBuilderTone,
  type AiBuilderCreativity,
} from '@/lib/validation/ai-builder';

const GOAL_COPY: Record<AiBuilderGoal, { title: string; hint: string }> = {
  sales: { title: he.aiBuilderGoalSales, hint: he.aiBuilderGoalSalesHint },
  trust: { title: he.aiBuilderGoalTrust, hint: he.aiBuilderGoalTrustHint },
  explain: { title: he.aiBuilderGoalExplain, hint: he.aiBuilderGoalExplainHint },
  recruit: { title: he.aiBuilderGoalRecruit, hint: he.aiBuilderGoalRecruitHint },
};

const TONE_COPY: Record<AiBuilderTone, string> = {
  warm: he.aiBuilderToneWarm,
  professional: he.aiBuilderToneProfessional,
  bold: he.aiBuilderToneBold,
  minimal: he.aiBuilderToneMinimal,
};

const CREATIVITY_COPY: Record<AiBuilderCreativity, { title: string; hint?: string }> = {
  safe: { title: he.aiBuilderCreativitySafe, hint: he.aiBuilderCreativitySafeHint },
  balanced: { title: he.aiBuilderCreativityBalanced },
  bold: { title: he.aiBuilderCreativityBold, hint: he.aiBuilderCreativityBoldHint },
};

function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  render,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  render: (opt: T) => { title: string; hint?: string };
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {options.map((opt) => {
        const copy = render(opt);
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              'text-start rounded-xl border px-4 py-3 transition-all',
              active ? 'border-ink shadow-card scale-[1.01]' : 'border-line hover:border-ink/30',
            )}
            aria-pressed={active}
          >
            <div className="font-semibold text-sm">{copy.title}</div>
            {copy.hint && <div className="text-xs text-muted mt-0.5">{copy.hint}</div>}
          </button>
        );
      })}
    </div>
  );
}

const STEPS = ['goal', 'tone', 'creativity', 'details'] as const;

export default function AiBuilderWizard({
  onSubmit,
  busy,
  onCancel,
}: {
  onSubmit: (answers: AiBuilderAnswers) => void;
  busy: boolean;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<AiBuilderGoal | null>(null);
  const [tone, setTone] = useState<AiBuilderTone | null>(null);
  const [creativity, setCreativity] = useState<AiBuilderCreativity | null>(null);
  const [audienceHint, setAudienceHint] = useState('');
  const [sellingPoints, setSellingPoints] = useState('');

  const canAdvance = [goal !== null, tone !== null, creativity !== null, true][step];
  const stepKey = STEPS[step];

  const submit = () => {
    if (!goal || !tone || !creativity) return;
    onSubmit({ goal, tone, creativity, audienceHint, sellingPoints });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-ink' : 'bg-line')}
          />
        ))}
      </div>

      {stepKey === 'goal' && (
        <div>
          <p className="font-semibold mb-3">{he.aiBuilderStepGoal}</p>
          <OptionGrid options={AI_BUILDER_GOALS} value={goal} onChange={setGoal} render={(o) => GOAL_COPY[o]} />
        </div>
      )}

      {stepKey === 'tone' && (
        <div>
          <p className="font-semibold mb-3">{he.aiBuilderStepTone}</p>
          <OptionGrid options={AI_BUILDER_TONES} value={tone} onChange={setTone} render={(o) => ({ title: TONE_COPY[o] })} />
        </div>
      )}

      {stepKey === 'creativity' && (
        <div>
          <p className="font-semibold mb-3">{he.aiBuilderStepCreativity}</p>
          <OptionGrid
            options={AI_BUILDER_CREATIVITY}
            value={creativity}
            onChange={setCreativity}
            render={(o) => CREATIVITY_COPY[o]}
          />
        </div>
      )}

      {stepKey === 'details' && (
        <div className="space-y-4">
          <p className="font-semibold">{he.aiBuilderStepDetails}</p>
          <Field label={he.aiBuilderAudienceHint}>
            <Textarea
              rows={2}
              value={audienceHint}
              placeholder={he.aiBuilderAudienceHintPlaceholder}
              onChange={(e) => setAudienceHint(e.target.value)}
            />
          </Field>
          <Field label={he.aiBuilderSellingPoints}>
            <Textarea
              rows={2}
              value={sellingPoints}
              placeholder={he.aiBuilderSellingPointsPlaceholder}
              onChange={(e) => setSellingPoints(e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}>
          {he.aiBuilderBack}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button size="sm" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)} className="ms-auto">
            {he.aiBuilderNext}
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={submit} className="ms-auto">
            {busy ? he.aiBuilderGenerating : he.aiBuilderGenerate}
          </Button>
        )}
      </div>
    </div>
  );
}
