import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { listActiveSessions } from '@/lib/session-registry/registry';
import { greetingKeyFor, jerusalemHour } from '@/lib/achievements';
import { relativeHe } from '@/lib/relative-time';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import TiltCard from '@/components/fx/TiltCard';
import NavTile from '@/components/ui/NavTile';
import EmptyState from '@/components/ui/EmptyState';
import { Card, CardHeader } from '@/components/ui/Card';
import { ADMIN_SECTIONS } from '@/lib/admin-sections';
import { he } from '@/lib/he';

interface ActivityEvent {
  key: string;
  icon: string;
  label: string;
  detail: string;
  at: Date;
  href?: string;
}

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  if (auth.role === 'OWNER') {
    const db = forTenant(auth.tenantId!);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      me,
      courseCount,
      publishedCount,
      studentCount,
      newEnrollments30,
      students,
      recentEnrollments,
      recentStudents,
      recentPurchases,
      recentReviews,
      recentQuestions,
    ] = await Promise.all([
      db.user.findFirst({ where: { id: auth.userId }, select: { name: true, email: true } }),
      db.course.count(),
      db.course.count({ where: { status: 'PUBLISHED' } }),
      db.user.count({ where: { role: 'STUDENT' } }),
      db.enrollment.count({ where: { createdAt: { gte: since30 } } }),
      db.user.findMany({
        where: { role: { in: ['STUDENT', 'INSTRUCTOR'] } },
        select: { id: true },
      }),
      db.enrollment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, createdAt: true, studentId: true, courseId: true },
      }),
      db.user.findMany({
        where: { role: 'STUDENT' },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, createdAt: true, name: true, email: true },
      }),
      db.purchase.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, createdAt: true, payerName: true, payerEmail: true, amount: true },
      }),
      db.courseReview.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, createdAt: true, name: true, rating: true },
      }),
      db.lessonQuestion.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, createdAt: true, studentName: true },
      }),
    ]);

    // Screens open right now across the whole school — the same window the
    // device limiter counts, summed over every student and instructor.
    const screensNow = (
      await Promise.all(students.map((u) => listActiveSessions(u.id)))
    ).reduce((sum, list) => sum + list.length, 0);

    // Resolve names for the enrollment events in two batched lookups.
    const enrollUserIds = [...new Set(recentEnrollments.map((e) => e.studentId))];
    const enrollCourseIds = [...new Set(recentEnrollments.map((e) => e.courseId))];
    const [enrollUsers, enrollCourses] = await Promise.all([
      enrollUserIds.length
        ? db.user.findMany({
            where: { id: { in: enrollUserIds } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
      enrollCourseIds.length
        ? db.course.findMany({
            where: { id: { in: enrollCourseIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
    ]);
    const userById = new Map(enrollUsers.map((u) => [u.id, u.name || u.email]));
    const courseById = new Map(enrollCourses.map((c) => [c.id, c.title]));

    const events: ActivityEvent[] = [
      ...recentEnrollments.map((e) => ({
        key: `enroll-${e.id}`,
        icon: '🎓',
        label: he.activityEnrolled,
        detail: `${userById.get(e.studentId) ?? ''} · ${courseById.get(e.courseId) ?? ''}`,
        at: e.createdAt,
        href: `/t/${slug}/admin/students`,
      })),
      ...recentStudents.map((u) => ({
        key: `join-${u.id}`,
        icon: '👋',
        label: he.activityJoined,
        detail: u.name || u.email,
        at: u.createdAt,
        href: `/t/${slug}/admin/students`,
      })),
      ...recentPurchases.map((p) => ({
        key: `buy-${p.id}`,
        icon: '💳',
        label: he.activityPurchase,
        detail: `${p.payerName || p.payerEmail}${p.amount ? ` · ${p.amount}` : ''}`,
        at: p.createdAt,
        href: `/t/${slug}/admin/payments`,
      })),
      ...recentReviews.map((r) => ({
        key: `review-${r.id}`,
        icon: '⭐',
        label: he.activityReview,
        detail: `${r.name} · ${'★'.repeat(r.rating)}`,
        at: r.createdAt,
      })),
      ...recentQuestions.map((q) => ({
        key: `qa-${q.id}`,
        icon: '💬',
        label: he.activityQuestion,
        detail: q.studentName,
        at: q.createdAt,
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 8);

    const greeting = he[greetingKeyFor(jerusalemHour(new Date()))];
    const firstName = (me?.name || me?.email || '').split(/[@ ]/)[0];

    return (
      <div>
        <PageHeader
          kicker={he.dashboard}
          title={`${greeting}, ${firstName}! 👋`}
          subtitle={he.adminOverviewSubtitle}
          actions={
            <>
              <Link
                href={`/t/${slug}/admin/students`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-xl px-4 py-2 bg-card border border-line shadow-card hover:shadow-lift transition-shadow"
              >
                ✉️ {he.adminInviteStudent}
              </Link>
              <Link
                href={`/t/${slug}/admin/courses/new`}
                className="inline-flex items-center bg-copper-500 hover:bg-copper-600 text-white text-sm font-semibold rounded-xl px-4 py-2 transition-colors"
              >
                + {he.newCourseWizard}
              </Link>
            </>
          }
        />

        {/* Pulse: the four numbers an owner checks first */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="animate-rise rise-1">
            <StatCard
              label={he.adminStatScreensNow}
              value={
                <span className="inline-flex items-center gap-2">
                  {screensNow}
                  {screensNow > 0 && (
                    <span className="w-2 h-2 rounded-full bg-live animate-pulse-live" />
                  )}
                </span>
              }
              sub={he.adminStatScreensSub}
              href={`/t/${slug}/admin/sessions`}
              accent={screensNow > 0}
            />
          </div>
          <div className="animate-rise rise-2">
            <StatCard
              label={he.students}
              value={studentCount}
              sub={he.adminStatStudentsSub}
              href={`/t/${slug}/admin/students`}
            />
          </div>
          <div className="animate-rise rise-3">
            <StatCard
              label={he.adminStatNewEnrollments}
              value={newEnrollments30}
              sub={he.adminStat30d}
              href={`/t/${slug}/admin/analytics`}
            />
          </div>
          <div className="animate-rise rise-4">
            <StatCard
              label={he.courses}
              value={courseCount}
              sub={`${publishedCount} ${he.published}`}
              href={`/t/${slug}/admin/courses`}
            />
          </div>
        </div>

        {/* Recent activity feed */}
        <Card className="mb-10 animate-rise rise-5">
          <CardHeader title={he.adminActivityTitle} subtitle={he.adminActivitySubtitle} />
          {events.length === 0 ? (
            <EmptyState icon="📡" title={he.adminActivityEmpty} hint={he.adminActivityEmptyHint} />
          ) : (
            <ul className="divide-y divide-line">
              {events.map((ev) => {
                const row = (
                  <div className="flex items-center gap-4 px-5 py-3.5">
                    <span className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-lg shrink-0">
                      {ev.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">{ev.label}</p>
                      <p className="text-sm text-muted truncate">{ev.detail}</p>
                    </div>
                    <span className="text-xs text-muted shrink-0 tabular-nums">
                      {relativeHe(ev.at.getTime())}
                    </span>
                  </div>
                );
                return (
                  <li key={ev.key}>
                    {ev.href ? (
                      <Link href={ev.href} className="block hover:bg-brand-50 transition-colors">
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* The 4-part navigation tiles */}
        <p className="kicker mb-4">{he.adminAllSections}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {ADMIN_SECTIONS.map((s, i) => (
            <div key={s.key} className={`animate-rise rise-${Math.min(i + 1, 6)}`}>
              <NavTile href={s.href(slug)} icon={s.icon} label={s.label} description={s.description} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Instructors don't manage students, sessions, or marketing/settings — a
  // plain course-focused overview, no tiles needed.
  const db = forTenant(auth.tenantId!);
  const [courseCount, publishedCount, landingCount] = await Promise.all([
    db.course.count(),
    db.course.count({ where: { status: 'PUBLISHED' } }),
    db.course.count({ where: { landingPublished: true } }),
  ]);

  return (
    <div>
      <PageHeader
        kicker={he.dashboard}
        title={he.instructorOverviewTitle}
        actions={
          <Link
            href={`/t/${slug}/admin/courses/new`}
            className="inline-flex items-center bg-copper-500 hover:bg-copper-600 text-white text-sm font-semibold rounded-xl px-4 py-2 transition-colors"
          >
            + {he.newCourseWizard}
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8">
        <div className="animate-rise rise-1">
          <TiltCard maxTilt={5} className="rounded-xl2 h-full">
            <StatCard
              label={he.courses}
              value={courseCount}
              sub={`${publishedCount} ${he.published}`}
              href={`/t/${slug}/admin/courses`}
            />
          </TiltCard>
        </div>
        <div className="animate-rise rise-2">
          <TiltCard maxTilt={5} className="rounded-xl2 h-full">
            <StatCard label={he.landingPage} value={landingCount} sub={he.landingPublished} />
          </TiltCard>
        </div>
      </div>
    </div>
  );
}
