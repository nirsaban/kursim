import Link from 'next/link';
import { cn } from '@/lib/cn';

export default function StatCard({
  label,
  value,
  sub,
  href,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div
      className={cn(
        'bg-card border border-line rounded-lg p-4 sm:p-5 h-full transition-[box-shadow,border-color] duration-200',
        href && 'hover:shadow-lift hover:border-brand-300',
      )}
    >
      <p className="kicker">{label}</p>
      <p
        className={cn(
          'font-display text-2xl sm:text-3xl font-bold mt-2 tabular-nums',
          accent ? 'text-copper-600' : 'text-ink',
        )}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted mt-1.5">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
