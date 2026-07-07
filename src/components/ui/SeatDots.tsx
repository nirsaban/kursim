import { cn } from '@/lib/cn';

export type SeatState = 'active' | 'occupied' | 'idle' | 'free' | 'limit-active' | 'limit';

const seatStyles: Record<SeatState, string> = {
  active: 'bg-live animate-pulse-live',
  occupied: 'bg-live',
  idle: 'bg-seat',
  free: 'border-2 border-dashed border-seat box-border',
  'limit-active': 'bg-coin animate-pulse-amber',
  limit: 'bg-coin',
};

/**
 * The seats motif (● ● ○) — connected devices as pulsing dots.
 * `dark` renders free seats against a dark ink surface.
 */
export default function SeatDots({
  seats,
  size = 'md',
  dark,
  className,
}: {
  seats: SeatState[];
  size?: 'sm' | 'md' | 'lg';
  dark?: boolean;
  className?: string;
}) {
  const dim = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' }[size];
  const gap = { sm: 'gap-1', md: 'gap-1.5', lg: 'gap-2' }[size];
  return (
    <span className={cn('inline-flex items-center', gap, className)}>
      {seats.map((s, i) => (
        <span
          key={i}
          className={cn(
            'rounded-full flex-none',
            dim,
            seatStyles[s],
            s === 'free' && dark && 'border-brand-400',
          )}
        />
      ))}
    </span>
  );
}
