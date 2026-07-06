import { cn } from '@/lib/cn';

export default function ProgressBar({
  value,
  className,
  tone = 'brand',
}: {
  value: number; // 0..100
  className?: string;
  tone?: 'brand' | 'ok';
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn('h-1.5 bg-ink/[0.07] rounded-full overflow-hidden', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          tone === 'ok' ? 'bg-ok' : 'bg-brand-500',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
