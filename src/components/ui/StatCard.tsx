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
        'bg-white border border-line rounded-xl2 shadow-card p-5 h-full transition-shadow',
        href && 'hover:shadow-lift',
      )}
    >
      <p className="kicker">{label}</p>
      <p
        className={cn(
          'font-display text-3xl font-bold mt-2 tabular-nums',
          accent ? 'text-brand-700' : 'text-ink',
        )}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted mt-1.5">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
