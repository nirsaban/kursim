import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { parseMarketing } from '@/lib/validation/marketing';
import { parseHomepage } from '@/lib/validation/homepage';
import { darkenHex, parseBranding } from '@/lib/validation/branding';
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
import Icon from '@/components/ui/Icon';
import Monogram from '@/components/ui/Monogram';
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
  // Branding-studio accent wins over the homepage theme when the owner set one.
  const branding = parseBranding(tenant.branding);
  const accent = branding.primary ?? theme.main;
  // The hero stays near-ink: the accent only warms it, never shouts.
  const heroBackground = branding.primary
    ? `linear-gradient(135deg, #12151D 30%, ${darkenHex(branding.primary, 0.72)})`
    : `linear-gradient(135deg, #12151D 30%, ${theme.deep})`;

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
  const hasCourses = dash.courses.length > 0;

  // Wishlist state for catalog toggles (students only).
  const wishlistIds = new Set(
    (await db.wishlist.findMany({ where: { studentId: auth.userId }, select: { courseId: true } })).map(
      (w) => w.courseId,
    ),
  );
  const isStudent = auth.role === 'STUDENT';

  return (
    <div>
      {/* Hero: quiet ink surface, typographic hierarchy, one clear action */}
      <section
        className="rounded-xl2 overflow-hidden mb-8 animate-rise text-paper"
        style={{ background: heroBackground }}
      >
        <div className="p-5 sm:p-8">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
            <div className="min-w-0">
              <p className="text-paper/60 text-sm">{greeting}</p>
              <h1 className="font-display text-xl sm:text-3xl font-black mt-1 leading-snug">
                {hp.welcomeHeadline || he.homeSubtitle}
              </h1>
            </div>
            {streak > 0 && (
              <span className="ms-auto inline-flex items-center gap-1.5 text-sm text-paper/75 border border-paper/20 rounded-full px-3 py-1.5">
                <Icon name="flame" size={15} />
                <span className="tabular-nums font-semibold">{streak}</span> {he.streakDays}
              </span>
            )}
          </div>

          {hasCourses && (
            <div className="mt-6 bg-card text-ink rounded-xl shadow-lift p-4 sm:p-5">
              {target ? (
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <Monogram name={target.courseTitle} size="lg" />
                  <div className="flex-1 min-w-44">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                      {he.continueLearning} · {target.pct}%
                    </p>
                    <p className="font-display font-bold text-base sm:text-lg leading-snug mt-0.5">
                      {target.lessonTitle}
                    </p>
                    <p className="text-sm text-muted mt-0.5 truncate">{target.courseTitle}</p>
                  </div>
                  <Link
                    href={`/t/${slug}/lesson/${target.lessonId}`}
                    className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 text-white font-semibold rounded-xl px-5 min-h-[44px] transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.98]"
                    style={{ background: accent }}
                  >
                    <Icon name="play" size={14} />
                    {he.continueWatching}
                  </Link>
                </div>
              ) : (
                <div>
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
        <nav className="flex flex-wrap gap-2 mb-8" aria-label={he.myCourses}>
          {(
            [
              { href: `/t/${slug}/certificates`, icon: 'award', label: he.certificatesTitle },
              { href: `/t/${slug}/wishlist`, icon: 'bookmark', label: he.wishlistTitle },
              { href: `/t/${slug}/redeem`, icon: 'ticket', label: he.redeem },
            ] as const
          ).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex items-center gap-2 text-sm font-medium text-ink bg-card border border-line rounded-full px-4 min-h-[44px] transition-[border-color,transform] duration-150 hover:border-brand-300 active:scale-[0.98]"
            >
              <Icon name={l.icon} size={16} className="text-muted" />
              {l.label}
            </Link>
          ))}
        </nav>
      )}

      {/* Personal stats */}
      {hp.showStats && hasCourses && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-10">
          <StatCard label={he.statsLessonsDone} value={dash.totals.lessonsDone} />
          <StatCard label={he.statsCoursesDone} value={dash.totals.coursesDone} />
          <StatCard
            label={he.statsStreak}
            value={
              <span className="inline-flex items-center gap-2">
                {streak}
                {streak > 0 && <Icon name="flame" size={18} className="text-copper-500" />}
              </span>
            }
            href={`/t/${slug}/journey`}
          />
          <StatCard label={he.statsMinutes} value={dash.totals.minutes} />
        </div>
      )}

      {/* Course journeys */}
      <div className="flex items-baseline gap-3 mb-5">
        <h2 className="font-display text-xl font-bold">{he.myCourses}</h2>
        <span className="hidden sm:inline text-sm text-muted">{he.homeSubtitle}</span>
      </div>
      {!hasCourses ? (
        <EmptyState
          icon={<Icon name="book" size={22} />}
          title={he.noCourses}
          hint={he.noCoursesHint}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 mt-10 items-start">
          {hp.announcements.length > 0 && (
            <AnnouncementsCard announcements={hp.announcements} />
          )}
          {hp.aboutSchool && (
            <Card className={hp.announcements.length === 0 ? 'lg:col-span-2' : undefined}>
              <CardBody>
                <div className="flex items-center gap-3 mb-3">
                  <Monogram name={tenant.name} tint={theme.soft} ink={theme.deep} />
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
            <span className="hidden sm:inline text-sm text-muted">{he.moreCoursesHint}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((course) => {
              const m = parseMarketing(course.marketing);
              const t = LANDING_THEMES[m.accent];
              const featured = course.id === hp.featuredCourseId;
              return (
                <a
                  key={course.id}
                  href={`/t/${slug}/c/${course.id}`}
                  className="group bg-card border border-line rounded-xl2 shadow-card hover:shadow-lift hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200 p-5 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Monogram name={m.headline || course.title} size="lg" tint={t.soft} ink={t.deep} />
                    <span className="flex items-center gap-2">
                      {isStudent && (
                        <WishlistButton courseId={course.id} initialSaved={wishlistIds.has(course.id)} />
                      )}
                      {featured && <Badge tone="copper">{he.featuredCourse}</Badge>}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-lg mt-4 leading-snug">
                    {m.headline || course.title}
                  </h3>
                  {(m.subheadline || course.description) && (
                    <p className="text-sm text-muted line-clamp-2 mt-1.5 leading-relaxed">
                      {m.subheadline || course.description}
                    </p>
                  )}
                  <span className="mt-4 pt-4 border-t border-line/70 flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-ink group-hover:text-brand-700 transition-colors">
                      {he.viewCourse}
                      <Icon name="arrowForward" size={15} className="text-muted" />
                    </span>
                    {m.priceText && (
                      <span className="font-display font-bold tabular-nums text-ink">
                        {m.priceText}
                      </span>
                    )}
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
