import { cn } from '@/lib/cn';

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn('bg-card border border-line rounded-xl2 shadow-card', className)}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 min-w-0">{actions}</div>}
    </div>
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('p-5', className)} />;
}
