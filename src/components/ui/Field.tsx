import { cn } from '@/lib/cn';

const inputBase =
  'w-full bg-card border border-brand-300 rounded-md px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 transition-[border-color,box-shadow] hover:border-brand-500 focus:border-copper-500 focus:shadow-[0_0_0_3px_rgba(109,40,210,0.15)] focus-visible:ring-0 focus-visible:ring-offset-0';

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
      <span className="block text-sm font-bold text-ink mb-1.5">{label}</span>
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
