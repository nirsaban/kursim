'use client';

import { he } from '@/lib/he';
import Button from '@/components/ui/Button';

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
      <Button onClick={onSave} disabled={busy}>
        {he.save}
      </Button>
      {saved && <span className="text-sm font-medium text-ok">{he.saved} ✓</span>}
      {error && <p className="text-sm text-danger font-medium">{error}</p>}
      {dirty && !busy && <span className="text-sm font-medium text-warn">{he.unsavedChanges}</span>}
      {right && <span className="ms-auto">{right}</span>}
    </div>
  );
}
