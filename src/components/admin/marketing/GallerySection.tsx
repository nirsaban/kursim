'use client';

import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { CourseMarketing } from '@/lib/validation/marketing';
import { useEditableResource } from '@/lib/client/useEditableResource';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import AiMediaCard from '@/components/admin/AiMediaCard';
import GalleryEditor from '@/components/admin/GalleryEditor';
import ResultsEditor from '@/components/admin/ResultsEditor';
import SaveBar from '@/components/admin/SaveBar';

export default function GallerySection({ courseId }: { courseId: string }) {
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
      <AiMediaCard courseId={courseId} />

      <Card>
        <CardHeader title={he.resultsSection} subtitle={he.resultsSubtitle} />
        <CardBody>
          <ResultsEditor
            courseId={courseId}
            items={m.results}
            onChange={(results) => set({ results })}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={he.gallerySection} subtitle={he.galleryTitle} />
        <CardBody>
          <GalleryEditor
            courseId={courseId}
            items={m.gallery}
            onChange={(gallery) => set({ gallery })}
          />
        </CardBody>
      </Card>

      <SaveBar busy={busy} saved={saved} dirty={dirty} onSave={() => save()} />
    </div>
  );
}
