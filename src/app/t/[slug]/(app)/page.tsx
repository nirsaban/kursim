import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { parseMarketing } from '@/lib/validation/marketing';
import { parseHomepage } from '@/lib/validation/homepage';
import { LANDING_THEMES } from '@/lib/landing-themes';
import {
  computeAchievements,
  computeStreak,
  dayKey,
  greetingKeyFor,
  jerusalemHour,
} from '@/lib/achievements';
import { getStudentDashboard } from '@/lib/student-dashboard';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import JourneyCourseCard from '@/components/student/JourneyCourseCard';
import AchievementsStrip from '@/components/student/AchievementsStrip';
import AnnouncementsCard from '@/components/student/AnnouncementsCard';
import WishlistButton from '@/components/WishlistButton';
import { he } from '@/lib/he';

export default async function StudentHomePage({
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
  // Staff land in admin — unless they explicitly opened the owner preview.
  if (isStaff && preview !== '1') redirect(`/t/${slug}/admin`);

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const hp = parseHomepage(tenant.homepage);
  const theme = LANDING_THEMES[hp.accent];

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
  const streak = computeStreak(activity.map((a) => dayKey(a.date)), now);
  const achievements = computeAchievements({
    completedLessons: dash.totals.lessonsDone,
    completedCourses: dash.totals.coursesDone,
    streak,
  });
  const greeting = he[greetingKeyFor(jerusalemHour(now))];

  // Catalog: published courses with a public landing page the student can join.
  const enrolledIds = new Set(dash.courses.map((c) => c.id));
  const catalog = (
    await db.course.findMany({
      where: { status: 'PUBLISHED', landingPublished: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, description: true, marketing: true },
    })
  ).filter((c) => !enrolledIds.has(c.id));
  if (hp.featuredCourseId) {
    const i = catalog.findIndex((c) => c.id === hp.featuredCourseId);
    if (i > 0) catalog.unshift(catalog.splice(i, 1)[0]);
  }

  const target = dash.continueTarget;
  const targetTheme = target ? LANDING_THEMES[target.accent] : theme;
  const hasCourses = dash.courses.length > 0;

  // Wishlist state for catalog toggles (students only).
  const wishlistIds = new Set(
    (await db.wishlist.findMany({ where: { studentId: auth.userId }, select: { courseId: true } })).map(
      (w) => w.courseId,
    ),
  );
  const isStudent = auth.role === 'STUDENT';
  const quickLink =
    'inline-flex items-center gap-1.5 text-sm font-semibold rounded-full px-4 py-2 bg-card border border-line shadow-card hover:shadow-lift hover:-translate-y-0.5 transition-all';

  return (
    <div>
      {/* Hero: greeting + streak + continue-learning card */}
      <section
        className="rounded-xl2 shadow-lift overflow-hidden mb-8 animate-rise"
        style={{ background: `linear-gradient(120deg, ${theme.deep}, ${theme.main})` }}
      >
        <div className="p-6 sm:p-8 text-white">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-white/70 text-sm font-medium">
                {greeting} {hp.emoji}
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-black mt-1">
                {hp.welcomeHeadline || he.homeSubtitle}
              </h1>
            </div>
            {streak > 0 && (
              <span className="ms-auto inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-4 py-2 text-sm font-bold">
                🔥 {streak} {he.streakDays}
              </span>
            )}
          </div>

          {hasCourses && (
            <div className="mt-6 bg-card text-ink rounded-xl2 shadow-card p-5 flex flex-wrap items-center gap-4">
              {target ? (
                <>
                  <span
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: targetTheme.soft }}
                  >
                    {target.emoji}
                  </span>
                  <div className="flex-1 min-w-48">
                    <p className="kicker">{he.continueLearning}</p>
                    <p className="font-display font-bold text-lg leading-snug">
                      {target.lessonTitle}
                    </p>
                    <p className="text-sm text-muted">
                      {target.courseTitle} · {target.pct}%
                    </p>
                  </div>
                  <Link
                    href={`/t/${slug}/lesson/${target.lessonId}`}
                    className="shrink-0 text-white font-semibold rounded-xl px-5 py-2.5 transition-opacity hover:opacity-90"
                    style={{ background: targetTheme.main }}
                  >
                    ▶ {he.continueWatching}
                  </Link>
                </>
              ) : (
                <div className="flex-1">
                  <p className="font-display font-bold text-lg">{he.allCaughtUp}</p>
                  <p className="text-sm text-muted mt-0.5">{he.allCaughtUpHint}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Quick links to the extended student features */}
      {isStudent && (
        <div className="flex flex-wrap gap-2.5 mb-8">
          <Link href={`/t/${slug}/certificates`} className={quickLink}>
            🎓 {he.certificatesTitle}
          </Link>
          <Link href={`/t/${slug}/wishlist`} className={quickLink}>
            🔖 {he.wishlistTitle}
          </Link>
          <Link href={`/t/${slug}/leaderboard`} className={quickLink}>
            🏆 {he.leaderboard}
          </Link>
          <Link href={`/t/${slug}/redeem`} className={quickLink}>
            🎟️ {he.redeem}
          </Link>
        </div>
      )}

      {/* Personal stats */}
      {hp.showStats && hasCourses && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard label={he.statsLessonsDone} value={dash.totals.lessonsDone} />
          <StatCard label={he.statsCoursesDone} value={dash.totals.coursesDone} />
          <StatCard
            label={he.statsStreak}
            value={`${streak} 🔥`}
            accent={streak >= 3}
            href={`/t/${slug}/journey`}
          />
          <StatCard label={he.statsMinutes} value={dash.totals.minutes} />
        </div>
      )}

      {/* Course journeys */}
      <div className="flex items-baseline gap-3 mb-5">
        <h2 className="font-display text-xl font-bold">{he.myCourses}</h2>
        <span className="text-sm text-muted">{he.homeSubtitle}</span>
      </div>
      {!hasCourses ? (
        <EmptyState icon="📚" title={he.noCourses} hint={he.noCoursesHint} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {dash.courses.map((course, i) => (
            <JourneyCourseCard key={course.id} slug={slug} course={course} index={i} />
          ))}
        </div>
      )}

      {/* Achievements */}
      {hp.showAchievements && hasCourses && (
        <AchievementsStrip achievements={achievements} slug={slug} />
      )}

      {/* Announcements + about the school */}
      {(hp.announcements.length > 0 || hp.aboutSchool) && (
        <div className="grid gap-5 lg:grid-cols-2 mt-10 items-start">
          {hp.announcements.length > 0 && (
            <AnnouncementsCard announcements={hp.announcements} />
          )}
          {hp.aboutSchool && (
            <Card className={hp.announcements.length === 0 ? 'lg:col-span-2' : undefined}>
              <CardBody>
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ background: theme.soft }}
                  >
                    {hp.emoji}
                  </span>
                  <h2 className="font-display font-bold text-lg">
                    {he.aboutSchoolTitle} — {tenant.name}
                  </h2>
                </div>
                <p className="text-sm text-muted leading-relaxed whitespace-pre-line">
                  {hp.aboutSchool}
                </p>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Catalog */}
      {hp.showCatalog && catalog.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline gap-3 mb-5">
            <h2 className="font-display text-xl font-bold">{he.moreCourses}</h2>
            <span className="text-sm text-muted">{he.moreCoursesHint}</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((course) => {
              const m = parseMarketing(course.marketing);
              const t = LANDING_THEMES[m.accent];
              const featured = course.id === hp.featuredCourseId;
              return (
                <a
                  key={course.id}
                  href={`/t/${slug}/c/${course.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-card border border-line rounded-xl2 shadow-card hover:shadow-lift hover:-translate-y-1 transition-all duration-300 p-5 flex flex-col"
                  style={featured ? { borderColor: t.main } : undefined}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                      style={{ background: t.soft }}
                    >
                      {m.emoji}
                    </span>
                    <span className="flex items-center gap-2">
                      {isStudent && (
                        <WishlistButton courseId={course.id} initialSaved={wishlistIds.has(course.id)} />
                      )}
                      {featured && <Badge tone="copper">⭐ {he.featuredCourse}</Badge>}
                      {m.priceText && (
                        <span
                          className="text-sm font-display font-bold rounded-full px-3 py-1"
                          style={{ background: t.soft, color: t.deep }}
                        >
                          {m.priceText}
                        </span>
                      )}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-lg mt-3 group-hover:opacity-80 transition-opacity">
                    {m.headline || course.title}
                  </h3>
                  {(m.subheadline || course.description) && (
                    <p className="text-sm text-muted line-clamp-2 mt-1">
                      {m.subheadline || course.description}
                    </p>
                  )}
                  <span
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
                    style={{ color: t.main }}
                  >
                    {he.viewCourse} ↗
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
