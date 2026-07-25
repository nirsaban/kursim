import Link from 'next/link';
import { cn } from '@/lib/cn';

export default function NavTile({
  href,
  icon,
  label,
  description,
  liveDot,
}: {
  href: string;
  icon: string;
  label: string;
  description: string;
  liveDot?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group bg-card border border-line rounded-xl2 shadow-card p-6 sm:p-7 h-full flex flex-col gap-3',
        'transition-all duration-300 hover:shadow-lift hover:-translate-y-1',
      )}
    >
      <span
        className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center text-2xl shrink-0 transition-transform group-hover:scale-105"
        aria-hidden
      >
        {icon}
      </span>
      <div>
        <h3 className="font-display font-bold text-lg text-ink flex items-center gap-2">
          {label}
          {liveDot && <span className="w-[7px] h-[7px] rounded-full bg-live animate-pulse-live" />}
        </h3>
        <p className="text-sm text-muted mt-1.5 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}
