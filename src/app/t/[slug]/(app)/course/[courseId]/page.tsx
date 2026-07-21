import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import ProgressBar from '@/components/ui/ProgressBar';
import ReviewPrompt from '@/components/ReviewPrompt';
import CourseSummary from '@/components/CourseSummary';
import AffiliateCard from '@/components/AffiliateCard';
import { he } from '@/lib/he';

function fmtDuration(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

// Drip release: students only see a module once dripDays have passed since enrollment.
// Mirrors the check in lesson/[lessonId]/page.tsx so the lock is visible before navigating.
function dripLockedDaysFor(dripDays: number | null | undefined, enrolledAt: Date | null): number {
  if (!enrolledAt) return 0;
  const days = dripDays ?? 0;
  if (days <= 0) return 0;
  const unlockAt = new Date(enrolledAt.getTime() + days * 86_400_000);
  if (Date.now() < unlockAt.getTime()) {
    return Math.ceil((unlockAt.getTime() - Date.now()) / 86_400_000);
  }
  return 0;
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  const db = forTenant(auth.tenantId!);
  const course = await db.course.findFirst({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { sortOrder: 'asc' },
        include: { lessons: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });
  if (!course) notFound();

  let enrolledAt: Date | null = null;
  if (auth.role === 'STUDENT') {
    if (course.status !== 'PUBLISHED') notFound();
    const enrolled = await db.enrollment.findFirst({
      where: { studentId: auth.userId, courseId },
    });
    if (!enrolled) redirect(`/t/${slug}`);
    enrolledAt = enrolled.createdAt;
  }

  const progress = await db.progress.findMany({
    where: { studentId: auth.userId, lesson: { module: { courseId } } },
    select: { lessonId: true, completedAt: true, lastPositionSec: true },
  });
  const completed = new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId));
  const started = new Set(
    progress.filter((p) => !p.completedAt && p.lastPositionSec > 0).map((p) => p.lessonId),
  );

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const pct = allLessons.length
    ? Math.round((allLessons.filter((l) => completed.has(l.id)).length / allLessons.length) * 100)
    : 0;
  const nextLesson =
    allLessons.find((l) => started.has(l.id)) ?? allLessons.find((l) => !completed.has(l.id));

  // Course finished → invite the student to leave a review (once).
  let showReviewPrompt = false;
  if (auth.role === 'STUDENT' && allLessons.length > 0 && pct === 100) {
    const existingReview = await db.courseReview.findFirst({
      where: { courseId, studentId: auth.userId },
      select: { id: true },
    });
    showReviewPrompt = !existingReview;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href={`/t/${slug}`} className="text-sm text-brand-700 hover:underline font-medium">
        → {he.backToCourses}
      </Link>

      <div className="bg-card border border-line rounded-xl2 shadow-card p-6 mt-4 mb-8">
        <h1 className="font-display text-3xl font-bold">{course.title}</h1>
        {course.description && <p className="text-muted mt-2 leading-relaxed">{course.description}</p>}
        <div className="flex items-center gap-4 mt-5">
          <div className="flex-1">
            <ProgressBar value={pct} tone={pct === 100 ? 'ok' : 'brand'} />
          </div>
          <span className="text-sm font-semibold text-brand-700 tabular-nums shrink-0">
            {pct}% {he.completed}
          </span>
          {nextLesson && (
            <Link
              href={`/t/${slug}/lesson/${nextLesson.id}`}
              className="shrink-0 bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold rounded-xl px-4 py-2 transition-colors"
            >
              ▶ {he.continueWatching}
            </Link>
          )}
        </div>
      </div>

      {auth.role === 'STUDENT' && allLessons.length > 0 && pct === 100 && (
        <div className="mb-8 space-y-6">
          <CourseSummary modules={course.modules} />
          {showReviewPrompt && <ReviewPrompt courseId={courseId} />}
        </div>
      )}

      {auth.role === 'STUDENT' && course.landingPublished && (
        <div className="mb-8">
          <AffiliateCard courseId={courseId} />
        </div>
      )}

      <div className="space-y-6">
        {course.modules.map((mod, mi) => {
          const moduleLockedDays = dripLockedDaysFor(mod.dripDays, enrolledAt);
          return (
            <section key={mod.id}>
              <div className="flex items-baseline gap-3 mb-3 px-1">
                <span className="kicker">
                  {he.modules} {mi + 1}
                </span>
                <h2 className="font-display font-bold text-lg">{mod.title}</h2>
              </div>
              <div className="bg-card border border-line rounded-xl2 shadow-card overflow-hidden">
                {mod.lessons.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-muted">{he.noLessons}</p>
                ) : (
                  <ul className="divide-y divide-line/70">
                    {mod.lessons.map((lesson) => {
                      const isDone = completed.has(lesson.id);
                      const isStarted = started.has(lesson.id);
                      if (moduleLockedDays > 0) {
                        return (
                          <li key={lesson.id}>
                            <div className="flex items-center gap-3 px-5 py-3.5 opacity-60 cursor-not-allowed">
                              <span
                                className="w-6 h-6 rounded-full border-2 border-line shrink-0 flex items-center justify-center text-xs"
                                aria-hidden
                              >
                                🔒
                              </span>
                              <span className="flex-1 font-medium">{lesson.title}</span>
                              <span className="text-xs text-muted shrink-0">
                                {he.dripLockedIn.replace('{n}', String(moduleLockedDays))}
                              </span>
                            </div>
                          </li>
                        );
                      }
                      return (
                        <li key={lesson.id}>
                          <Link
                            href={`/t/${slug}/lesson/${lesson.id}`}
                            className="flex items-center gap-3 px-5 py-3.5 hover:bg-paper transition-colors"
                          >
                            <span
                              className={
                                isDone
                                  ? 'w-6 h-6 rounded-full bg-ok text-white text-xs flex items-center justify-center shrink-0'
                                  : isStarted
                                    ? 'w-6 h-6 rounded-full border-2 border-brand-500 text-brand-700 text-[10px] flex items-center justify-center shrink-0'
                                    : 'w-6 h-6 rounded-full border-2 border-line shrink-0'
                              }
                              aria-hidden
                            >
                              {isDone ? '✓' : isStarted ? '▶' : ''}
                            </span>
                            <span className="flex-1 font-medium">{lesson.title}</span>
                            {lesson.videoPublicId && (
                              <span className="text-muted text-xs" aria-hidden>
                                🎬
                              </span>
                            )}
                            {lesson.durationSec ? (
                              <span className="text-xs text-muted tabular-nums" dir="ltr">
                                {fmtDuration(lesson.durationSec)}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
