import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import LessonPlayer from '@/components/LessonPlayer';
import LessonQA, { QAItem } from '@/components/LessonQA';
import LessonNotes from '@/components/LessonNotes';
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

  // Prev/next within the course for player navigation
  const allLessons = await db.lesson.findMany({
    where: { module: { courseId: lesson.module.courseId } },
    orderBy: [{ module: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    select: { id: true, title: true },
  });
  const idx = allLessons.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? allLessons[idx - 1] : null;
  const next = idx >= 0 && idx < allLessons.length - 1 ? allLessons[idx + 1] : null;

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
        <h1 className="font-display text-2xl sm:text-3xl font-bold">{lesson.title}</h1>
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
