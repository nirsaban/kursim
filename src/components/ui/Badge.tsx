import { cn } from '@/lib/cn';

type Tone = 'brand' | 'ok' | 'danger' | 'warn' | 'neutral' | 'copper';

const tones: Record<Tone, string> = {
  brand: 'bg-ink text-paper',
  ok: 'bg-ok-soft text-ok',
  danger: 'bg-danger-soft text-danger',
  warn: 'bg-warn-soft text-warn',
  neutral: 'bg-paper text-muted border border-line',
  copper: 'bg-copper-100 text-copper-700',
};

const dotColors: Record<Tone, string> = {
  brand: 'bg-paper',
  ok: 'bg-live',
  danger: 'bg-danger',
  warn: 'bg-coin',
  neutral: 'bg-seat',
  copper: 'bg-copper-500',
};

export default function Badge({
  tone = 'neutral',
  className,
  dot,
  pulse,
  children,
}: {
  tone?: Tone;
  className?: string;
  dot?: boolean;
  pulse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1',
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            dotColors[tone],
            pulse && (tone === 'warn' ? 'animate-pulse-amber' : 'animate-pulse-live'),
          )}
        />
      )}
      {children}
    </span>
  );
}
