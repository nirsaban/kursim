import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import LessonPlayer from '@/components/LessonPlayer';
import LessonQA, { QAItem } from '@/components/LessonQA';
import LessonNotes from '@/components/LessonNotes';
import LessonNav, { LessonNavItem } from '@/components/LessonNav';
import { he } from '@/lib/he';

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

  const isStudent = auth.role === 'STUDENT';
  const isStaff = auth.role === 'OWNER' || auth.role === 'INSTRUCTOR';

  let enrolledAt: Date | null = null;
  if (isStudent) {
    if (lesson.module.course.status !== 'PUBLISHED') notFound();
    const enrolled = await db.enrollment.findFirst({
      where: { studentId: auth.userId, courseId: lesson.module.courseId },
    });
    if (!enrolled) redirect(`/t/${slug}`);
    enrolledAt = enrolled.createdAt;
  }

  // Drip release: students only see a module once dripDays have passed since enrollment.
  const dripDays = lesson.module.dripDays ?? 0;
  let dripLockedDays = 0;
  if (isStudent && dripDays > 0 && enrolledAt) {
    const unlockAt = new Date(enrolledAt.getTime() + dripDays * 86_400_000);
    if (Date.now() < unlockAt.getTime()) {
      dripLockedDays = Math.ceil((unlockAt.getTime() - Date.now()) / 86_400_000);
    }
  }

  const header = (
    <>
      <Link
        href={`/t/${slug}/course/${lesson.module.courseId}`}
        className="text-sm text-brand-700 hover:underline font-medium"
      >
        → {lesson.module.course.title}
      </Link>
      <div className="flex items-baseline gap-3 mt-2 mb-5">
        <p className="kicker">{lesson.module.title}</p>
        <h1 className="font-display text-2xl sm:text-3xl">{lesson.title}</h1>
      </div>
    </>
  );

  if (dripLockedDays > 0) {
    return (
      <div className="max-w-3xl mx-auto">
        {header}
        <div className="bg-card border border-line rounded-xl2 shadow-card p-10 text-center">
          <div className="text-4xl mb-3" aria-hidden>🔒</div>
          <p className="font-display text-xl font-bold">{he.moduleLockedTitle}</p>
          <p className="text-muted mt-2">{he.dripLockedIn.replace('{n}', String(dripLockedDays))}</p>
        </div>
      </div>
    );
  }

  const progress = isStudent
    ? await db.progress.findFirst({
        where: { studentId: auth.userId, lessonId },
        select: { lastPositionSec: true },
      })
    : null;

  // Whole-course outline, so the player can jump straight to any lesson.
  const allLessons = await db.lesson.findMany({
    where: { module: { courseId: lesson.module.courseId } },
    orderBy: [{ module: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    select: {
      id: true,
      title: true,
      module: { select: { id: true, title: true, dripDays: true } },
    },
  });
  const doneIds = new Set<string>(
    isStudent
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
      : [],
  );
  const navLessons: LessonNavItem[] = allLessons.map((l) => {
    const drip = l.module.dripDays ?? 0;
    return {
      id: l.id,
      title: l.title,
      moduleId: l.module.id,
      moduleTitle: l.module.title,
      completed: doneIds.has(l.id),
      locked:
        isStudent && enrolledAt !== null && drip > 0
          ? Date.now() < enrolledAt.getTime() + drip * 86_400_000
          : false,
    };
  });

  const questionsRaw = await db.lessonQuestion.findMany({
    where: { lessonId },
    orderBy: { createdAt: 'desc' },
  });
  const questions: QAItem[] = questionsRaw.map((q) => ({
    id: q.id,
    studentName: q.studentName,
    body: q.body,
    answer: q.answer,
    answeredAt: q.answeredAt ? q.answeredAt.toISOString() : null,
    createdAt: q.createdAt.toISOString(),
  }));

  const note = isStudent
    ? await db.lessonNote.findFirst({
        where: { studentId: auth.userId, lessonId },
        select: { body: true },
      })
    : null;

  return (
    <div className="max-w-3xl mx-auto">
      {header}

      <LessonPlayer
        lessonId={lesson.id}
        initialPositionSec={progress?.lastPositionSec ?? 0}
        isStudent={isStudent}
      />

      <LessonNav slug={slug} lessons={navLessons} currentId={lesson.id} />

      {lesson.notes && (
        <div className="mt-6 bg-card border border-line rounded-xl2 shadow-card p-6">
          <p className="kicker mb-2">{he.lessonNotes}</p>
          <div className="whitespace-pre-wrap text-ink leading-relaxed">{lesson.notes}</div>
        </div>
      )}

      {isStudent && (
        <LessonNotes lessonId={lesson.id} courseId={lesson.module.courseId} initialBody={note?.body ?? ''} />
      )}

      <LessonQA
        lessonId={lesson.id}
        isStudent={isStudent}
        isStaff={isStaff}
        initialQuestions={questions}
      />
    </div>
  );
}
