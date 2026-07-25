'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { he } from '@/lib/he';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface CourseHead {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED';
}

/**
 * Title/description autosave + publish toggle + delete — shown above every
 * course sub-page (content, students, marketing, ...), so it lives in the
 * course-level layout rather than being duplicated per page.
 */
export default function CourseHeader({
  courseId,
  tenantSlug,
  isOwner,
}: {
  courseId: string;
  tenantSlug: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [course, setCourse] = useState<CourseHead | null>(null);
  const [savedField, setSavedField] = useState<'title' | 'description' | null>(null);

  const reload = useCallback(async () => {
    const res = await apiFetch(`/api/courses/${courseId}`);
    if (res.ok) setCourse((await res.json()).course);
  }, [courseId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!course) {
    return <div className="h-24 rounded-xl2 bg-ink/[0.04] animate-pulse" />;
  }

  async function patchCourse(data: Record<string, unknown>, flashField?: 'title' | 'description') {
    const res = await apiFetch(`/api/courses/${courseId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (res.ok) {
      if (flashField) {
        setSavedField(flashField);
        setTimeout(() => setSavedField((f) => (f === flashField ? null : f)), 1500);
      }
      reload();
    }
  }

  async function deleteCourse() {
    if (!confirm(he.confirmDelete)) return;
    const res = await apiFetch(`/api/courses/${courseId}`, { method: 'DELETE' });
    if (res.ok) router.push(`/t/${tenantSlug}/admin/courses`);
  }

  return (
    <div className="bg-card border border-line rounded-xl2 shadow-card p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-52">
          <input
            className="font-display text-2xl font-bold bg-transparent border-b-2 border-transparent focus:border-brand-300 outline-none flex-1 min-w-0"
            defaultValue={course.title}
            aria-label={he.courseTitle}
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value !== course.title) {
                patchCourse({ title: e.target.value.trim() }, 'title');
              }
            }}
          />
          <span
            className={cn(
              'text-xs font-medium text-ok transition-opacity duration-300 shrink-0',
              savedField === 'title' ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden={savedField !== 'title'}
          >
            {he.saved}
          </span>
          <Badge tone={course.status === 'PUBLISHED' ? 'ok' : 'neutral'}>
            {course.status === 'PUBLISHED' ? he.published : he.draft}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={course.status === 'PUBLISHED' ? 'secondary' : 'primary'}
            size="sm"
            onClick={() =>
              patchCourse({ status: course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' })
            }
          >
            {course.status === 'PUBLISHED' ? he.unpublish : he.publish}
          </Button>
          {isOwner && (
            <Button variant="danger" size="sm" onClick={deleteCourse}>
              {he.delete}
            </Button>
          )}
        </div>
      </div>
      <textarea
        className="w-full text-sm text-muted bg-paper/70 rounded-xl p-3 outline-none mt-3 focus:ring-1 focus:ring-brand-300 resize-y"
        placeholder={he.courseDescription}
        defaultValue={course.description ?? ''}
        rows={2}
        onBlur={(e) => {
          if (e.target.value !== (course.description ?? '')) {
            patchCourse({ description: e.target.value || null }, 'description');
          }
        }}
      />
      <span
        className={cn(
          'block text-xs font-medium text-ok transition-opacity duration-300 mt-1',
          savedField === 'description' ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden={savedField !== 'description'}
      >
        {he.saved}
      </span>
    </div>
  );
}
