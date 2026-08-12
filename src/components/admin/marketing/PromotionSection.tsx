'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { CourseMarketing } from '@/lib/validation/marketing';
import { useEditableResource } from '@/lib/client/useEditableResource';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import SaveBar from '@/components/admin/SaveBar';

export default function PromotionSection({ courseId }: { courseId: string }) {
  const [otherCourses, setOtherCourses] = useState<{ id: string; title: string }[]>([]);
  const { value: m, set, save, saved, dirty, busy, error } = useEditableResource<CourseMarketing>({
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

  useEffect(() => {
    apiFetch('/api/courses')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setOtherCourses(
            (d.courses as { id: string; title: string }[]).filter((c) => c.id !== courseId),
          );
        }
      });
  }, [courseId]);

  if (!m) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={he.saleSection} subtitle={he.saleSectionHint} />
        <CardBody className="space-y-4">
          <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={m.sale.enabled}
              onChange={(e) => set({ sale: { ...m.sale, enabled: e.target.checked } })}
              className="w-4 h-4 accent-brand-700"
            />
            {he.saleEnable}
          </label>
          {m.sale.enabled && (
            <>
              <Field label={he.saleTitleLabel}>
                <Input
                  value={m.sale.title}
                  placeholder={he.saleTitlePlaceholder}
                  onChange={(e) => set({ sale: { ...m.sale, title: e.target.value } })}
                />
              </Field>
              <Field label={he.saleDescriptionLabel}>
                <Textarea
                  rows={3}
                  value={m.sale.description}
                  onChange={(e) => set({ sale: { ...m.sale, description: e.target.value } })}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={he.salePartnerCourse}>
                  <Select
                    value={m.sale.partnerCourseId}
                    onChange={(e) => set({ sale: { ...m.sale, partnerCourseId: e.target.value } })}
                  >
                    <option value="">{he.salePartnerNone}</option>
                    {otherCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={he.saleEndsAt} hint={he.saleEndsAtHint}>
                  <Input
                    type="date"
                    dir="ltr"
                    value={m.sale.endsAt}
                    onChange={(e) => set({ sale: { ...m.sale, endsAt: e.target.value } })}
                  />
                </Field>
              </div>
              <Field label={he.salePaymentLink} hint={he.salePaymentLinkHint}>
                <Input
                  dir="ltr"
                  value={m.sale.paymentLink}
                  placeholder="https://pay.example.com/..."
                  onChange={(e) => set({ sale: { ...m.sale, paymentLink: e.target.value } })}
                />
              </Field>
              {m.sale.endsAt && new Date(`${m.sale.endsAt}T23:59:59`) < new Date() && (
                <p className="text-sm font-medium text-warn">{he.saleExpired}</p>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <SaveBar busy={busy} saved={saved} dirty={dirty} error={error} onSave={() => save()} />
    </div>
  );
}
