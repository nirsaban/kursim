import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'cta';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-copper-500 text-white hover:bg-copper-600 active:bg-copper-700',
  secondary:
    'bg-transparent text-ink border border-ink hover:bg-ink/5 active:bg-ink/10',
  ghost: 'text-muted hover:text-ink hover:bg-ink/5',
  danger:
    'bg-danger-soft text-danger border border-danger-line hover:bg-danger/10',
  cta: 'bg-copper-500 text-white font-bold hover:bg-copper-600 active:bg-copper-700',
};

const sizes: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5 rounded-md gap-1 min-h-[36px]',
  md: 'text-sm px-4 py-2 rounded-lg gap-1.5 min-h-[44px]',
  lg: 'text-base px-6 py-3 rounded-lg gap-2 min-h-[48px]',
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
        'inline-flex items-center justify-center font-bold transition-[background-color,border-color,color] duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        variants[variant],
        sizes[size],
        className,
      )}
    />
  );
}
