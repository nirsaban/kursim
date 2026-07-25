'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import ContentTab, { CourseStructure } from '@/components/admin/ContentTab';

export default function ContentSectionClient({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<CourseStructure | null>(null);

  const reload = useCallback(async () => {
    const res = await apiFetch(`/api/courses/${courseId}`);
    if (res.ok) setCourse((await res.json()).course);
  }, [courseId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!course) {
    return <div className="h-64 rounded-xl2 bg-ink/[0.04] animate-pulse" />;
  }

  return <ContentTab course={course} courseId={courseId} reload={reload} />;
}
