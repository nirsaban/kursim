import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import { he } from '@/lib/he';

/**
 * Opening an enrolled course drops the student straight into the lecture
 * they should watch next (in-progress first, then the first unfinished one),
 * the way a course-taking app does. Only a lesson-less course renders here.
 */
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
    select: {
      id: true,
      title: true,
      status: true,
      modules: {
        orderBy: { sortOrder: 'asc' },
        select: { lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true } } },
      },
    },
  });
  if (!course) notFound();

  if (auth.role === 'STUDENT') {
    if (course.status !== 'PUBLISHED') notFound();
    const enrolled = await db.enrollment.findFirst({
      where: { studentId: auth.userId, courseId },
      select: { id: true },
    });
    if (!enrolled) redirect(`/t/${slug}`);
  }

  const allLessons = course.modules.flatMap((m) => m.lessons);
  if (allLessons.length > 0) {
    const progress = await db.progress.findMany({
      where: { studentId: auth.userId, lesson: { module: { courseId } } },
      select: { lessonId: true, completedAt: true, lastPositionSec: true },
    });
    const completed = new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId));
    const started = new Set(
      progress.filter((p) => !p.completedAt && p.lastPositionSec > 0).map((p) => p.lessonId),
    );
    const target =
      allLessons.find((l) => started.has(l.id)) ??
      allLessons.find((l) => !completed.has(l.id)) ??
      allLessons[0];
    redirect(`/t/${slug}/lesson/${target.id}`);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href={`/t/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-copper-700 hover:underline font-bold min-h-[44px]"
      >
        <Icon name="arrowBack" size={15} />
        {he.backToCourses}
      </Link>
      <h1 className="font-display text-2xl sm:text-3xl mt-2 mb-6">{course.title}</h1>
      <div className="border border-line rounded-lg">
        <EmptyState icon={<Icon name="book" size={22} />} title={he.learnCourseEmpty} />
      </div>
    </div>
  );
}
