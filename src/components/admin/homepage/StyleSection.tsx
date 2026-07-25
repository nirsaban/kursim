'use client';

import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { TenantHomepage } from '@/lib/validation/homepage';
import { useEditableResource } from '@/lib/client/useEditableResource';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { AccentPicker, EmojiPicker } from '@/components/admin/MarketingFields';
import SaveBar from '@/components/admin/SaveBar';

export default function StyleSection() {
  const { value: hp, set, save, saved, dirty, busy, error } = useEditableResource<TenantHomepage>({
    load: async () => {
      const res = await apiFetch('/api/settings/homepage');
      return res.ok ? (await res.json()).homepage : null;
    },
    save: async (toSave) => {
      const payload = { ...toSave, announcements: toSave.announcements.filter((a) => a.title.trim()) };
      const res = await apiFetch('/api/settings/homepage', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return res.ok;
    },
  });

  if (!hp) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={he.homepageStyle} />
        <CardBody className="space-y-5">
          <AccentPicker value={hp.accent} onChange={(accent) => set({ accent })} />
          <EmojiPicker value={hp.emoji} onChange={(emoji) => set({ emoji })} />
        </CardBody>
      </Card>

      <SaveBar busy={busy} saved={saved} dirty={dirty} error={error} onSave={() => save()} />
    </div>
  );
}
