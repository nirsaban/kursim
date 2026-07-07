import { cn } from '@/lib/cn';

export function TableWrap({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        'bg-card border border-line rounded-xl2 shadow-card overflow-x-auto',
        className,
      )}
    />
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table {...props} className={cn('w-full text-sm', className)} />;
}

export function Th({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      className={cn(
        'text-start px-4 py-3 text-xs font-semibold text-muted bg-paper/60 border-b border-line whitespace-nowrap',
        className,
      )}
    />
  );
}

export function Td({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td {...props} className={cn('px-4 py-3 border-b border-line/60 align-middle', className)} />
  );
}
