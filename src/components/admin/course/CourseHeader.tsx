'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import SavedFlash from '@/components/ui/SavedFlash';

interface CourseHead {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  catalogNumber: number;
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
  const [savedField, setSavedField] = useState<'title' | 'description' | 'catalogNumber' | null>(
    null,
  );
  const [catalogError, setCatalogError] = useState<string | null>(null);

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

  async function patchCourse(
    data: Record<string, unknown>,
    flashField?: 'title' | 'description' | 'catalogNumber',
  ) {
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
      return true;
    }
    return false;
  }

  /** Catalog numbers must stay unique per school — the API 409s on a clash. */
  async function saveCatalogNumber(raw: string) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
      setCatalogError(he.catalogNumberInvalid);
      return;
    }
    setCatalogError(null);
    const ok = await patchCourse({ catalogNumber: n }, 'catalogNumber');
    if (!ok) setCatalogError(he.catalogNumberTaken);
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
          <SavedFlash shown={savedField === 'title'} />
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
            <>
              <span className="w-px h-5 bg-line shrink-0" aria-hidden />
              <Button variant="danger" size="sm" onClick={deleteCourse}>
                {he.delete}
              </Button>
            </>
          )}
        </div>
      </div>
      <textarea
        className="w-full text-sm text-muted bg-brand-50 rounded-xl p-3 outline-none mt-3 focus:ring-1 focus:ring-brand-300 resize-y"
        placeholder={he.courseDescription}
        defaultValue={course.description ?? ''}
        rows={2}
        onBlur={(e) => {
          if (e.target.value !== (course.description ?? '')) {
            patchCourse({ description: e.target.value || null }, 'description');
          }
        }}
      />
      <div className="mt-1">
        <SavedFlash shown={savedField === 'description'} />
      </div>

      {/* Catalog number — the key that ties this course to its Grow product. */}
      <div className="mt-3 pt-3 border-t border-line flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label htmlFor="catalogNumber" className="text-sm font-semibold text-ink shrink-0">
            {he.catalogNumber}
          </label>
          <input
            id="catalogNumber"
            type="number"
            min={1}
            dir="ltr"
            className="w-24 text-sm bg-brand-50 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-brand-300 text-center"
            defaultValue={course.catalogNumber}
            onBlur={(e) => {
              if (e.target.value !== String(course.catalogNumber)) {
                saveCatalogNumber(e.target.value);
              }
            }}
          />
          <SavedFlash shown={savedField === 'catalogNumber'} />
        </div>
        <p className="text-xs text-muted leading-relaxed flex-1 min-w-52">
          {catalogError ? (
            <span className="text-danger font-medium">{catalogError}</span>
          ) : (
            he.catalogNumberHint
          )}
        </p>
      </div>
    </div>
  );
}
