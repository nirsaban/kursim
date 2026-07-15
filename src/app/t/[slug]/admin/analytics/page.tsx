import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import ProgressBar from '@/components/ui/ProgressBar';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { he } from '@/lib/he';

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}`);

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const db = forTenant(auth.tenantId!);

  const now = Date.now();
  const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [
    totalStudents,
    totalEnrollments,
    activity7,
    activity30,
    completedProgress,
    certificatesIssued,
    courses,
    enrollments,
    allCompletedProgress,
  ] = await Promise.all([
    db.user.count({ where: { role: 'STUDENT' } }),
    db.enrollment.count(),
    db.learningActivity.findMany({
      where: { date: { gte: since7 } },
      select: { studentId: true },
    }),
    db.learningActivity.findMany({
      where: { date: { gte: since30 } },
      select: { studentId: true },
    }),
    db.progress.findMany({
      where: { completedAt: { not: null } },
      select: { lessonId: true },
    }),
    db.certificate.count(),
    db.course.findMany({
      select: {
        id: true,
        title: true,
        modules: { select: { lessons: { select: { id: true, durationSec: true } } } },
      },
    }),
    db.enrollment.findMany({ select: { courseId: true, studentId: true } }),
    db.progress.findMany({
      where: { completedAt: { not: null } },
      select: { studentId: true, lessonId: true },
    }),
  ]);

  const activeStudents7 = new Set(activity7.map((a) => a.studentId)).size;
  const activeStudents30 = new Set(activity30.map((a) => a.studentId)).size;
  const lessonsCompleted = completedProgress.length;

  // Total learning minutes: sum durationSec of every completed lesson occurrence.
  const durationByLesson = new Map<string, number>();
  for (const c of courses) {
    for (const mod of c.modules) {
      for (const l of mod.lessons) durationByLesson.set(l.id, l.durationSec ?? 0);
    }
  }
  let totalSeconds = 0;
  for (const p of completedProgress) totalSeconds += durationByLesson.get(p.lessonId) ?? 0;
  const totalLearningMinutes = Math.round(totalSeconds / 60);

  // Completion by course: fraction of enrolled students who completed all lessons.
  const enrolledByCourse = new Map<string, Set<string>>();
  for (const e of enrollments) {
    if (!enrolledByCourse.has(e.courseId)) enrolledByCourse.set(e.courseId, new Set());
    enrolledByCourse.get(e.courseId)!.add(e.studentId);
  }
  const completedLessonsByStudent = new Map<string, Set<string>>();
  for (const p of allCompletedProgress) {
    if (!completedLessonsByStudent.has(p.studentId))
      completedLessonsByStudent.set(p.studentId, new Set());
    completedLessonsByStudent.get(p.studentId)!.add(p.lessonId);
  }

  const completionByCourse = courses.map((c) => {
    const lessonIds = c.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const enrolled = enrolledByCourse.get(c.id) ?? new Set<string>();
    let finishers = 0;
    if (lessonIds.length > 0) {
      for (const studentId of enrolled) {
        const done = completedLessonsByStudent.get(studentId);
        if (done && lessonIds.every((id) => done.has(id))) finishers += 1;
      }
    }
    const enrolledCount = enrolled.size;
    const pct = enrolledCount > 0 ? Math.round((finishers / enrolledCount) * 100) : 0;
    return { id: c.id, title: c.title, enrolled: enrolledCount, pct };
  });

  const hasData =
    totalStudents > 0 || totalEnrollments > 0 || courses.length > 0 || lessonsCompleted > 0;

  return (
    <div>
      <PageHeader kicker={he.admin} title={he.analytics} subtitle={he.analyticsSubtitle} />

      {!hasData ? (
        <EmptyState icon="📊" title={he.analyticsNoData} />
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
            <StatCard label={he.totalStudents} value={totalStudents} />
            <StatCard label={he.activeStudents7} value={activeStudents7} accent />
            <StatCard label={he.activeStudents30} value={activeStudents30} />
            <StatCard label={he.totalEnrollments} value={totalEnrollments} />
            <StatCard label={he.analyticsLessonsCompleted} value={lessonsCompleted} />
            <StatCard label={he.totalLearningMinutes} value={totalLearningMinutes} />
            <StatCard label={he.certificatesIssued} value={certificatesIssued} />
          </div>

          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="font-display text-xl font-bold">{he.completionByCourse}</h2>
          </div>
          {completionByCourse.length === 0 ? (
            <EmptyState icon="📚" title={he.noCourses} />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>{he.courses}</Th>
                    <Th>{he.enrollments}</Th>
                    <Th className="w-1/3">{he.avgCompletion}</Th>
                  </tr>
                </thead>
                <tbody>
                  {completionByCourse.map((c) => (
                    <tr key={c.id} className="hover:bg-paper/60 transition-colors">
                      <Td className="font-semibold">{c.title}</Td>
                      <Td className="tabular-nums">{c.enrolled}</Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <ProgressBar value={c.pct} tone={c.pct === 100 ? 'ok' : 'brand'} />
                          </div>
                          <span className="text-xs font-semibold tabular-nums w-9 text-end">
                            {c.pct}%
                          </span>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </>
      )}
    </div>
  );
}
