'use client';

import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { CourseMarketing } from '@/lib/validation/marketing';
import { useEditableResource } from '@/lib/client/useEditableResource';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { AccentPicker, EmojiPicker, LayoutPicker } from '@/components/admin/MarketingFields';
import SaveBar from '@/components/admin/SaveBar';

export default function StyleSection({ courseId }: { courseId: string }) {
  const { value: m, set, save, saved, dirty, busy } = useEditableResource<CourseMarketing>({
    load: async () => {
      const r = await apiFetch(`/api/courses/${courseId}/marketing`);
      return r.ok ? (await r.json()).marketing : null;
    },
    save: async (toSave) => {
      const r = await apiFetch(`/api/courses/${courseId}/marketing`, {
        method: 'PUT',
        body: JSON.stringify(toSave),
      });
      return r.ok;
    },
  });

  if (!m) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={he.layoutTitle} />
        <CardBody>
          <LayoutPicker value={m.layout} onChange={(layout) => set({ layout })} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${he.accentTitle} · ${he.emojiTitle}`} />
        <CardBody className="space-y-5">
          <AccentPicker value={m.accent} onChange={(accent) => set({ accent })} />
          <EmojiPicker value={m.emoji} onChange={(emoji) => set({ emoji })} />
        </CardBody>
      </Card>

      <SaveBar busy={busy} saved={saved} dirty={dirty} onSave={() => save()} />
    </div>
  );
}
