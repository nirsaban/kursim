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
        'bg-card border border-line rounded-xl2 shadow-card p-4 sm:p-5 h-full transition-all duration-300',
        href && 'hover:shadow-lift hover:-translate-y-1',
      )}
    >
      <p className="kicker">{label}</p>
      <p
        className={cn(
          'font-display text-2xl sm:text-3xl font-black mt-2 tabular-nums',
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
