'use client';

import { he } from '@/lib/he';
import { Input, Textarea } from '@/components/ui/Field';
import { TenantHomepage } from '@/lib/validation/homepage';

type Announcement = TenantHomepage['announcements'][number];

/** Title + date + body rows — PairListEditor only supports two keys. */
export default function AnnouncementsEditor({
  values,
  onChange,
}: {
  values: Announcement[];
  onChange: (next: Announcement[]) => void;
}) {
  const update = (i: number, patch: Partial<Announcement>) =>
    onChange(values.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-3">
      {values.map((a, i) => (
        <div key={i} className="border border-line rounded-xl p-3 space-y-2 bg-paper/50">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <Input
                value={a.title}
                placeholder={he.announcementTitle}
                onChange={(e) => update(i, { title: e.target.value })}
              />
            </div>
            {/* wrapper fixes the width — Input's base w-full can't be overridden by className */}
            <div className="w-40 shrink-0">
              <Input
                type="date"
                dir="ltr"
                value={a.date}
                aria-label={he.announcementDate}
                onChange={(e) => update(i, { date: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="shrink-0 w-9 h-9 rounded-xl border border-line text-muted hover:text-danger hover:border-danger/40 transition-colors text-sm"
              aria-label={he.removeItem}
            >
              ✕
            </button>
          </div>
          <Textarea
            rows={2}
            value={a.body}
            placeholder={he.announcementBody}
            onChange={(e) => update(i, { body: e.target.value })}
          />
        </div>
      ))}
      {values.length < 10 && (
        <button
          type="button"
          onClick={() => onChange([...values, { title: '', body: '', date: '' }])}
          className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
        >
          + {he.addItem}
        </button>
      )}
    </div>
  );
}
