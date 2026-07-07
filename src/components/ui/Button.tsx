import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'cta';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-ink text-card hover:bg-ink-surface active:bg-brand-900 shadow-sm',
  secondary:
    'bg-transparent text-ink border-[1.5px] border-ink hover:bg-paper',
  ghost: 'text-muted hover:text-ink hover:bg-ink/5',
  danger:
    'bg-danger-soft text-danger border border-danger-line hover:bg-danger/10',
  cta: 'bg-copper-500 text-card font-bold hover:bg-copper-600 active:bg-copper-700 shadow-cta',
};

const sizes: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5 rounded-lg gap-1',
  md: 'text-sm px-4 py-2 rounded-xl gap-1.5',
  lg: 'text-base px-6 py-3 rounded-xl gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        variants[variant],
        sizes[size],
        className,
      )}
    />
  );
}
