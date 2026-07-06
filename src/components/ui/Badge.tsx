import { cn } from '@/lib/cn';

type Tone = 'brand' | 'ok' | 'danger' | 'warn' | 'neutral' | 'copper';

const tones: Record<Tone, string> = {
  brand: 'bg-brand-100 text-brand-800',
  ok: 'bg-ok/10 text-ok',
  danger: 'bg-danger/10 text-danger',
  warn: 'bg-warn/10 text-warn',
  neutral: 'bg-ink/5 text-muted',
  copper: 'bg-copper-100 text-copper-800',
};

export default function Badge({
  tone = 'neutral',
  className,
  dot,
  children,
}: {
  tone?: Tone;
  className?: string;
  dot?: boolean;
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
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
