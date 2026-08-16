import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { parseHomepage } from '@/lib/validation/homepage';
import { LANDING_THEMES } from '@/lib/landing-themes';
import { computeAchievements, computeStreak, dayKey } from '@/lib/achievements';
import { getStudentDashboard } from '@/lib/student-dashboard';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import ProgressBar from '@/components/ui/ProgressBar';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import Monogram from '@/components/ui/Monogram';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import ActivityCalendar from '@/components/student/ActivityCalendar';
import { he } from '@/lib/he';

export default async function JourneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  const isStaff = auth.role === 'OWNER' || auth.role === 'INSTRUCTOR';
  if (isStaff && preview !== '1') redirect(`/t/${slug}/admin`);

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const theme = LANDING_THEMES[parseHomepage(tenant.homepage).accent];

  const db = forTenant(auth.tenantId!);
  const [dash, activity] = await Promise.all([
    getStudentDashboard(db, auth.userId),
    db.learningActivity.findMany({
      where: { studentId: auth.userId },
      orderBy: { date: 'desc' },
      take: 60,
      select: { date: true },
    }),
  ]);

  const now = new Date();
  const todayKey = dayKey(now);
  const activeDays = activity.map((a) => dayKey(a.date));
  const streak = computeStreak(activeDays, now);
  const achievements = computeAchievements({
    completedLessons: dash.totals.lessonsDone,
    completedCourses: dash.totals.coursesDone,
    streak,
  });
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <div>
      <PageHeader kicker={he.myCourses} title={he.journeyTitle} subtitle={he.journeySubtitle} />

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <StatCard
          label={he.statsStreak}
          value={
            <span className="inline-flex items-center gap-2">
              {streak}
              {streak > 0 && <Icon name="flame" size={18} className="text-copper-500" />}
            </span>
          }
        />
        <StatCard label={he.statsLessonsDone} value={dash.totals.lessonsDone} />
        <StatCard label={he.statsMinutes} value={dash.totals.minutes} />
        <StatCard
          label={he.achievementsUnlocked}
          value={`${unlocked}/${achievements.length}`}
        />
      </div>

      {/* Activity calendar */}
      <Card className="mb-8">
        <CardHeader
          title={he.activityLast4Weeks}
          subtitle={`${new Set(activeDays).size} ${he.activityDaysCount}`}
        />
        <CardBody>
          <ActivityCalendar activeDays={activeDays} todayKey={todayKey} color={theme.main} />
        </CardBody>
      </Card>

      {/* All achievements */}
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="font-display text-xl font-bold">{he.achievementsTitle}</h2>
        <span className="text-sm text-muted">
          {unlocked}/{achievements.length}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-10">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={
              a.unlocked
                ? 'bg-card border border-line rounded-xl2 shadow-card p-4'
                : 'border border-dashed border-line rounded-xl2 p-4'
            }
          >
            <span
              className={
                a.unlocked
                  ? 'w-9 h-9 rounded-xl bg-copper-50 text-copper-600 grid place-items-center'
                  : 'w-9 h-9 rounded-xl bg-paper text-muted/40 grid place-items-center'
              }
            >
              <Icon name={a.icon} size={17} />
            </span>
            <p
              className={
                a.unlocked
                  ? 'font-display font-bold mt-3 text-ink'
                  : 'font-display font-bold mt-3 text-muted/60'
              }
            >
              {he[a.titleKey]}
            </p>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {a.unlocked ? he[a.descKey] : he.achievementLocked}
            </p>
          </div>
        ))}
      </div>

      {/* Per-course breakdown */}
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="font-display text-xl font-bold">{he.perCourseProgress}</h2>
      </div>
      {dash.courses.length === 0 ? (
        <EmptyState
          icon={<Icon name="book" size={22} />}
          title={he.noCourses}
          hint={he.noCoursesHint}
        />
      ) : (
        <>
          {/* Phones: stacked rows — a wide table has no honest place on a narrow screen */}
          <div className="sm:hidden space-y-3">
            {dash.courses.map((c) => (
              <Link
                key={c.id}
                href={`/t/${slug}/course/${c.id}`}
                className="block bg-card border border-line rounded-xl2 shadow-card p-4 active:scale-[0.99] transition-transform duration-150"
              >
                <div className="flex items-center gap-3">
                  <Monogram name={c.title} size="sm" />
                  <span className="font-semibold text-ink flex-1 min-w-0 truncate">{c.title}</span>
                  <span className="text-xs font-semibold tabular-nums text-ink shrink-0">
                    {c.pct}%
                  </span>
                </div>
                <div className="mt-3">
                  <ProgressBar value={c.pct} tone={c.pct === 100 ? 'ok' : 'brand'} />
                </div>
                <p className="text-xs text-muted tabular-nums mt-2">
                  {c.completedLessons}/{c.totalLessons} {he.lessons} ·{' '}
                  {c.milestones.filter((m) => m.done).length}/{c.milestones.length} {he.modules}
                </p>
              </Link>
            ))}
          </div>

          <TableWrap className="hidden sm:block">
            <Table>
              <thead>
                <tr>
                  <Th>{he.courses}</Th>
                  <Th>{he.modules}</Th>
                  <Th>{he.lessons}</Th>
                  <Th className="w-1/3">{he.progress}</Th>
                </tr>
              </thead>
              <tbody>
                {dash.courses.map((c) => (
                  <tr key={c.id} className="hover:bg-paper/60 transition-colors">
                    <Td>
                      <Link
                        href={`/t/${slug}/course/${c.id}`}
                        className="font-semibold hover:underline inline-flex items-center gap-2.5"
                      >
                        <Monogram name={c.title} size="sm" />
                        {c.title}
                      </Link>
                    </Td>
                    <Td className="tabular-nums">
                      {c.milestones.filter((m) => m.done).length}/{c.milestones.length}
                    </Td>
                    <Td className="tabular-nums">
                      {c.completedLessons}/{c.totalLessons}
                    </Td>
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
        </>
      )}
    </div>
  );
}
