'use client';

import { he } from '@/lib/he';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export default function SaveBar({
  busy,
  saved,
  dirty,
  onSave,
  error,
  right,
}: {
  busy: boolean;
  saved: boolean;
  dirty: boolean;
  onSave: () => void;
  error?: string | null;
  right?: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-4 flex items-center gap-3 bg-card/95 backdrop-blur border border-line rounded-xl2 shadow-lift px-5 py-3">
      <Button variant="cta" onClick={onSave} disabled={busy}>
        {busy && (
          <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-card border-t-transparent animate-spin" />
        )}
        {he.save}
      </Button>
      <span className={cn('text-sm font-medium text-ok transition-opacity duration-200', saved ? 'opacity-100' : 'opacity-0')}>
        {he.saved} ✓
      </span>
      {error && <p className="text-sm text-danger font-medium">{error}</p>}
      <span
        className={cn(
          'text-sm font-medium text-warn transition-opacity duration-200',
          dirty && !busy ? 'opacity-100' : 'opacity-0',
        )}
      >
        {he.unsavedChanges}
      </span>
      {right && <span className="ms-auto">{right}</span>}
    </div>
  );
}
