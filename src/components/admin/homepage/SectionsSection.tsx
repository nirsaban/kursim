'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { TenantHomepage } from '@/lib/validation/homepage';
import { useEditableResource } from '@/lib/client/useEditableResource';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Select } from '@/components/ui/Field';
import SaveBar from '@/components/admin/SaveBar';

export default function SectionsSection() {
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
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

  useEffect(() => {
    apiFetch('/api/courses')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setCourses(
            (d.courses as { id: string; title: string; status?: string }[]).filter(
              (c) => c.status === 'PUBLISHED',
            ),
          );
        }
      });
  }, []);

  if (!hp) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={he.homepageSections} />
        <CardBody className="space-y-4">
          {(
            [
              ['showStats', he.homepageShowStats],
              ['showAchievements', he.homepageShowAchievements],
              ['showCatalog', he.homepageShowCatalog],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2.5 text-sm font-medium cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={hp[key]}
                onChange={(e) => set({ [key]: e.target.checked })}
                className="w-4 h-4 accent-brand-700"
              />
              {label}
            </label>
          ))}
          {hp.showCatalog && (
            <Field label={he.homepageFeaturedCourse}>
              <Select
                value={hp.featuredCourseId}
                onChange={(e) => set({ featuredCourseId: e.target.value })}
              >
                <option value="">{he.homepageFeaturedNone}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </CardBody>
      </Card>

      <SaveBar busy={busy} saved={saved} dirty={dirty} error={error} onSave={() => save()} />
    </div>
  );
}
