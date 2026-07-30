'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { CourseMarketing } from '@/lib/validation/marketing';
import { useEditableResource } from '@/lib/client/useEditableResource';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Textarea } from '@/components/ui/Field';
import Button from '@/components/ui/Button';
import { PairListEditor, StringListEditor } from '@/components/admin/MarketingFields';
import LandingAiBuilder from '@/components/admin/ai-builder/LandingAiBuilder';
import SaveBar from '@/components/admin/SaveBar';

export default function CopySection({
  courseId,
  tenantSlug,
}: {
  courseId: string;
  tenantSlug: string;
}) {
  const [courseTitle, setCourseTitle] = useState('');
  const [showAiBuilder, setShowAiBuilder] = useState(false);
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

  useEffect(() => {
    apiFetch(`/api/courses/${courseId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setCourseTitle(d.course.title);
      });
  }, [courseId]);

  if (!m) return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;

  if (showAiBuilder) {
    return (
      <LandingAiBuilder
        courseId={courseId}
        tenantSlug={tenantSlug}
        courseTitle={courseTitle}
        currentMarketing={m}
        onApply={set}
        onConfirm={async (toSave) => {
          await save(toSave);
        }}
        onClose={() => setShowAiBuilder(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex items-center flex-wrap justify-between gap-4">
          <div className="min-w-0">
            <p className="font-semibold">{he.aiBuilderTitle}</p>
            <p className="text-sm text-muted mt-0.5">{he.aiBuilderSubtitle}</p>
          </div>
          <Button variant="secondary" className="shrink-0" onClick={() => setShowAiBuilder(true)}>
            {he.aiBuilderOpen}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={he.headline} subtitle={he.headlineSubtitle} />
        <CardBody className="space-y-4">
          <Field label={he.headline}>
            <Input
              value={m.headline}
              placeholder={courseTitle}
              onChange={(e) => set({ headline: e.target.value })}
            />
          </Field>
          <Field label={he.subheadline}>
            <Textarea
              rows={2}
              value={m.subheadline}
              onChange={(e) => set({ subheadline: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={he.instructorName}>
              <Input
                value={m.instructorName}
                onChange={(e) => set({ instructorName: e.target.value })}
              />
            </Field>
            <Field label={he.priceText}>
              <Input value={m.priceText} onChange={(e) => set({ priceText: e.target.value })} />
            </Field>
          </div>
          <Field label={he.aboutSchool}>
            <Textarea
              rows={3}
              value={m.aboutSchool}
              onChange={(e) => set({ aboutSchool: e.target.value })}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={he.storyTitle} subtitle={he.storySubtitle} />
        <CardBody>
          <PairListEditor
            values={m.story}
            onChange={(story) => set({ story: story as CourseMarketing['story'] })}
            aKey="title"
            bKey="body"
            aPlaceholder={he.storySectionTitle}
            bPlaceholder={he.storySectionBody}
            bMultiline
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${he.audienceTitle} · ${he.outcomesTitle}`} />
        <CardBody className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium mb-2">{he.audienceTitle}</p>
            <StringListEditor
              values={m.audience}
              onChange={(audience) => set({ audience })}
              placeholder={he.audienceItem}
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-2">{he.outcomesTitle}</p>
            <StringListEditor
              values={m.outcomes}
              onChange={(outcomes) => set({ outcomes })}
              placeholder={he.outcomeItem}
              max={8}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={he.benefitsTitle} />
        <CardBody>
          <PairListEditor
            values={m.benefits}
            onChange={(benefits) => set({ benefits: benefits as CourseMarketing['benefits'] })}
            aKey="title"
            bKey="body"
            aPlaceholder={he.benefitTitle}
            bPlaceholder={he.benefitBody}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`${he.testimonialsTitle} · ${he.faqTitle}`} />
        <CardBody className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium mb-2">{he.testimonialsTitle}</p>
            <PairListEditor
              values={m.testimonials}
              onChange={(testimonials) =>
                set({ testimonials: testimonials as CourseMarketing['testimonials'] })
              }
              aKey="name"
              bKey="quote"
              aPlaceholder={he.testimonialName}
              bPlaceholder={he.testimonialQuote}
              bMultiline
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-2">{he.faqTitle}</p>
            <PairListEditor
              values={m.faq}
              onChange={(faq) => set({ faq: faq as CourseMarketing['faq'] })}
              aKey="q"
              bKey="a"
              aPlaceholder={he.faqQ}
              bPlaceholder={he.faqA}
              bMultiline
              max={10}
            />
          </div>
        </CardBody>
      </Card>

      <SaveBar busy={busy} saved={saved} dirty={dirty} onSave={() => save()} />
    </div>
  );
}
