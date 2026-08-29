import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseBranding } from '@/lib/validation/branding';
import { parseHomepage } from '@/lib/validation/homepage';
import LearnHeader from '@/components/learn/LearnHeader';
import LearnWorkspace from '@/components/learn/LearnWorkspace';
import type { SidebarSection } from '@/components/learn/CourseContentSidebar';
import type { QAItem } from '@/components/LessonQA';
import CourseSummary from '@/components/CourseSummary';
import ReviewPrompt from '@/components/ReviewPrompt';
import AffiliateCard from '@/components/AffiliateCard';
import { he } from '@/lib/he';

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug, lessonId } = await params;
  const { t } = await searchParams;
  // A deep link (e.g. from the mentor's cited timestamp) always wins over the
  // saved resume position — that's the point of following the link.
  const deepLinkSec = t !== undefined && /^\d+$/.test(t) ? Number(t) : null;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const db = forTenant(auth.tenantId!);
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId },
    include: { module: { include: { course: true } } },
  });
  if (!lesson) notFound();
  const course = lesson.module.course;

  const isStudent = auth.role === 'STUDENT';
  const isStaff = auth.role === 'OWNER' || auth.role === 'INSTRUCTOR';

  let enrolledAt: Date | null = null;
  if (isStudent) {
    if (course.status !== 'PUBLISHED') notFound();
    const enrolled = await db.enrollment.findFirst({
      where: { studentId: auth.userId, courseId: course.id },
    });
    if (!enrolled) redirect(`/t/${slug}`);
    enrolledAt = enrolled.createdAt;
  }

  // Drip release: students only see a module once dripDays have passed since enrollment.
  const lockedDaysFor = (dripDays: number | null) => {
    const days = dripDays ?? 0;
    if (!isStudent || !enrolledAt || days <= 0) return 0;
    const unlockAt = enrolledAt.getTime() + days * 86_400_000;
    return Date.now() < unlockAt ? Math.ceil((unlockAt - Date.now()) / 86_400_000) : 0;
  };
  const dripLockedDays = lockedDaysFor(lesson.module.dripDays);

  const modules = await db.module.findMany({
    where: { courseId: course.id },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      title: true,
      dripDays: true,
      lessons: {
        orderBy: { sortOrder: 'asc' },
        select: { id: true, title: true, durationSec: true, videoPublicId: true },
      },
    },
  });
  const allLessons = modules.flatMap((m) => m.lessons);
  const completedIds = isStudent
    ? (
        await db.progress.findMany({
          where: {
            studentId: auth.userId,
            lessonId: { in: allLessons.map((l) => l.id) },
            completedAt: { not: null },
          },
          select: { lessonId: true },
        })
      ).map((p) => p.lessonId)
    : [];
  const doneSet = new Set(completedIds);

  const sections: SidebarSection[] = modules.map((m) => {
    const locked = lockedDaysFor(m.dripDays) > 0;
    return {
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        durationSec: l.durationSec,
        hasVideo: Boolean(l.videoPublicId),
        completed: doneSet.has(l.id),
        locked,
      })),
    };
  });

  const branding = parseBranding(tenant.branding);
  const hp = parseHomepage(tenant.homepage);
  const header = (
    <LearnHeader
      slug={slug}
      brandName={tenant.name}
      brandLogoUrl={branding.logo ?? undefined}
      courseTitle={course.title}
      done={completedIds.length}
      total={allLessons.length}
    />
  );

  if (dripLockedDays > 0) {
    return (
      <>
        {header}
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <div className="text-4xl mb-3" aria-hidden>
            🔒
          </div>
          <p className="font-display text-2xl font-bold">{he.moduleLockedTitle}</p>
          <p className="text-muted mt-2">{he.dripLockedIn.replace('{n}', String(dripLockedDays))}</p>
        </div>
      </>
    );
  }

  const idx = allLessons.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? allLessons[idx - 1] : null;
  const next = idx >= 0 && idx < allLessons.length - 1 ? allLessons[idx + 1] : null;

  const [progress, questionsRaw, note] = await Promise.all([
    isStudent
      ? db.progress.findFirst({
          where: { studentId: auth.userId, lessonId },
          select: { lastPositionSec: true },
        })
      : null,
    db.lessonQuestion.findMany({ where: { lessonId }, orderBy: { createdAt: 'desc' } }),
    isStudent
      ? db.lessonNote.findFirst({
          where: { studentId: auth.userId, lessonId },
          select: { body: true },
        })
      : null,
  ]);
  const questions: QAItem[] = questionsRaw.map((q) => ({
    id: q.id,
    studentName: q.studentName,
    body: q.body,
    answer: q.answer,
    answeredAt: q.answeredAt ? q.answeredAt.toISOString() : null,
    createdAt: q.createdAt.toISOString(),
  }));

  // Course finished → recap + one-time review invite; affiliate card for published landings.
  const pct = allLessons.length ? Math.round((completedIds.length / allLessons.length) * 100) : 0;
  let completionExtras: React.ReactNode = null;
  if (isStudent) {
    let showReview = false;
    if (allLessons.length > 0 && pct === 100) {
      const existing = await db.courseReview.findFirst({
        where: { courseId: course.id, studentId: auth.userId },
        select: { id: true },
      });
      showReview = !existing;
    }
    const summaryModules =
      pct === 100
        ? await db.module.findMany({
            where: { courseId: course.id },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              title: true,
              lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, notes: true } },
            },
          })
        : [];
    completionExtras = (
      <>
        {pct === 100 && allLessons.length > 0 && <CourseSummary modules={summaryModules} />}
        {showReview && <ReviewPrompt courseId={course.id} />}
        {course.landingPublished && <AffiliateCard courseId={course.id} />}
      </>
    );
  }

  return (
    <>
      {header}
      <LearnWorkspace
        slug={slug}
        lesson={{ id: lesson.id, title: lesson.title, notes: lesson.notes, courseId: course.id }}
        index={idx}
        total={allLessons.length}
        prevHref={prev ? `/t/${slug}/lesson/${prev.id}` : null}
        nextHref={next ? `/t/${slug}/lesson/${next.id}` : null}
        initialPositionSec={deepLinkSec ?? progress?.lastPositionSec ?? 0}
        isStudent={isStudent}
        isStaff={isStaff}
        sections={sections}
        initialCompletedIds={completedIds}
        questions={questions}
        noteBody={note?.body ?? ''}
        announcements={hp.announcements}
        completionExtras={completionExtras}
      />
    </>
  );
}
