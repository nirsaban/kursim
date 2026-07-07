import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import LessonPlayer from '@/components/LessonPlayer';

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  const db = forTenant(auth.tenantId!);
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId },
    include: { module: { include: { course: true } } },
  });
  if (!lesson) notFound();

  if (auth.role === 'STUDENT') {
    if (lesson.module.course.status !== 'PUBLISHED') notFound();
    const enrolled = await db.enrollment.findFirst({
      where: { studentId: auth.userId, courseId: lesson.module.courseId },
    });
    if (!enrolled) redirect(`/t/${slug}`);
  }

  // Prev/next within the course for player navigation
  const allLessons = await db.lesson.findMany({
    where: { module: { courseId: lesson.module.courseId } },
    orderBy: [{ module: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    select: { id: true, title: true },
  });
  const idx = allLessons.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? allLessons[idx - 1] : null;
  const next = idx >= 0 && idx < allLessons.length - 1 ? allLessons[idx + 1] : null;

  const progress =
    auth.role === 'STUDENT'
      ? await db.progress.findFirst({
          where: { studentId: auth.userId, lessonId },
          select: { lastPositionSec: true },
        })
      : null;

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href={`/t/${slug}/course/${lesson.module.courseId}`}
        className="text-sm text-brand-700 hover:underline font-medium"
      >
        → {lesson.module.course.title}
      </Link>
      <div className="flex items-baseline gap-3 mt-2 mb-5">
        <p className="kicker">{lesson.module.title}</p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">{lesson.title}</h1>
      </div>

      <LessonPlayer
        lessonId={lesson.id}
        initialPositionSec={progress?.lastPositionSec ?? 0}
        isStudent={auth.role === 'STUDENT'}
      />

      {lesson.notes && (
        <div className="mt-6 bg-card border border-line rounded-xl2 shadow-card p-6">
          <p className="kicker mb-2">הערות לשיעור</p>
          <div className="whitespace-pre-wrap text-ink leading-relaxed">{lesson.notes}</div>
        </div>
      )}

      <div className="flex items-center justify-between mt-8">
        {prev ? (
          <Link
            href={`/t/${slug}/lesson/${prev.id}`}
            className="text-sm font-medium bg-card border border-line rounded-xl px-4 py-2.5 hover:border-brand-300 transition-colors max-w-[45%] truncate"
          >
            → {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/t/${slug}/lesson/${next.id}`}
            className="text-sm font-semibold bg-brand-700 text-white rounded-xl px-4 py-2.5 hover:bg-brand-800 transition-colors max-w-[45%] truncate"
          >
            {next.title} ←
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
