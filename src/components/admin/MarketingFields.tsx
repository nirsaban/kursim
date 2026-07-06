'use client';

import { cn } from '@/lib/cn';
import { he } from '@/lib/he';
import { Input, Textarea } from '@/components/ui/Field';
import { LANDING_THEMES, LANDING_EMOJI } from '@/lib/landing-themes';
import { LANDING_ACCENTS, LandingAccent } from '@/lib/validation/marketing';

export function StringListEditor({
  values,
  onChange,
  placeholder,
  max = 6,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      {values.map((v, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={v}
            placeholder={placeholder}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <RemoveButton onClick={() => onChange(values.filter((_, j) => j !== i))} />
        </div>
      ))}
      {values.length < max && (
        <AddButton onClick={() => onChange([...values, ''])} />
      )}
    </div>
  );
}

export function PairListEditor({
  values,
  onChange,
  aKey,
  bKey,
  aPlaceholder,
  bPlaceholder,
  bMultiline,
  max = 6,
}: {
  values: Array<Record<string, string>>;
  onChange: (next: Array<Record<string, string>>) => void;
  aKey: string;
  bKey: string;
  aPlaceholder: string;
  bPlaceholder: string;
  bMultiline?: boolean;
  max?: number;
}) {
  const update = (i: number, key: string, val: string) =>
    onChange(values.map((x, j) => (j === i ? { ...x, [key]: val } : x)));

  return (
    <div className="space-y-3">
      {values.map((v, i) => (
        <div key={i} className="border border-line rounded-xl p-3 space-y-2 bg-paper/50">
          <div className="flex gap-2">
            <Input
              value={v[aKey] ?? ''}
              placeholder={aPlaceholder}
              onChange={(e) => update(i, aKey, e.target.value)}
            />
            <RemoveButton onClick={() => onChange(values.filter((_, j) => j !== i))} />
          </div>
          {bMultiline ? (
            <Textarea
              rows={2}
              value={v[bKey] ?? ''}
              placeholder={bPlaceholder}
              onChange={(e) => update(i, bKey, e.target.value)}
            />
          ) : (
            <Input
              value={v[bKey] ?? ''}
              placeholder={bPlaceholder}
              onChange={(e) => update(i, bKey, e.target.value)}
            />
          )}
        </div>
      ))}
      {values.length < max && (
        <AddButton onClick={() => onChange([...values, { [aKey]: '', [bKey]: '' }])} />
      )}
    </div>
  );
}

export function AccentPicker({
  value,
  onChange,
}: {
  value: LandingAccent;
  onChange: (a: LandingAccent) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {LANDING_ACCENTS.map((key) => {
        const theme = LANDING_THEMES[key];
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all',
              active
                ? 'border-ink shadow-card scale-[1.02]'
                : 'border-line hover:border-ink/30',
            )}
            aria-pressed={active}
          >
            <span className="flex -space-x-1">
              <span
                className="w-5 h-5 rounded-full border-2 border-white"
                style={{ background: theme.deep }}
              />
              <span
                className="w-5 h-5 rounded-full border-2 border-white"
                style={{ background: theme.main }}
              />
              <span
                className="w-5 h-5 rounded-full border-2 border-white"
                style={{ background: theme.accent }}
              />
            </span>
            {theme.name}
          </button>
        );
      })}
    </div>
  );
}

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (e: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {LANDING_EMOJI.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => onChange(e)}
          className={cn(
            'w-11 h-11 rounded-xl border text-xl flex items-center justify-center transition-all',
            value === e
              ? 'border-brand-600 bg-brand-50 scale-[1.05]'
              : 'border-line hover:border-brand-300',
          )}
          aria-pressed={value === e}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
    >
      + {he.addItem}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 w-9 h-9 rounded-xl border border-line text-muted hover:text-danger hover:border-danger/40 transition-colors text-sm"
      aria-label={he.removeItem}
    >
      ✕
    </button>
  );
}
