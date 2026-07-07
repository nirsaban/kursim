import { cn } from '@/lib/cn';

const inputBase =
  'w-full bg-card border-[1.5px] border-line rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 transition-[border-color,box-shadow] hover:border-brand-300 focus:border-copper-500 focus:shadow-[0_0_0_3px_rgba(228,87,46,0.18)] focus-visible:ring-0 focus-visible:ring-offset-0';

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1.5">{hint}</span>}
    </label>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputBase, className)} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputBase, 'resize-y', className)} />;
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputBase, 'cursor-pointer', className)} />;
}
