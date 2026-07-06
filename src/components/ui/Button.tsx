import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'cta';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-sm',
  secondary:
    'bg-white text-ink border border-line hover:border-brand-300 hover:bg-brand-50',
  ghost: 'text-muted hover:text-ink hover:bg-ink/5',
  danger: 'bg-white text-danger border border-danger/30 hover:bg-danger/5',
  cta: 'bg-copper-600 text-white hover:bg-copper-700 active:bg-copper-800 shadow-sm',
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
