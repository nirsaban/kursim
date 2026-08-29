import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { parseMarketing } from '@/lib/validation/marketing';
import { parseHomepage } from '@/lib/validation/homepage';
import { LANDING_THEMES } from '@/lib/landing-themes';
import { computeAchievements, computeStreak, dayKey } from '@/lib/achievements';
import { getStudentDashboard } from '@/lib/student-dashboard';
import { isCloudinaryConfigured } from '@/lib/cloudinary/client';
import { signedDeliveryUrl, VIDEO_URL_TTL_SEC } from '@/lib/cloudinary/sign-delivery';
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
import { cn } from '@/lib/cn';
import { he } from '@/lib/he';

export default async function StudentHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; filter?: string }>;
}) {
  const { slug } = await params;
  const { preview, filter } = await searchParams;
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

  const hasCourses = dash.courses.length > 0;
  const wishlistIds = new Set(
    (await db.wishlist.findMany({ where: { studentId: auth.userId }, select: { courseId: true } })).map(
      (w) => w.courseId,
    ),
  );
  const isStudent = auth.role === 'STUDENT';

  const cloudinary = isCloudinaryConfigured();
  const coverUrl = (publicId: string | null) =>
    publicId && cloudinary ? signedDeliveryUrl(publicId, 'image', VIDEO_URL_TTL_SEC, 'jpg') : null;

  const activeFilter = filter === 'progress' || filter === 'done' ? filter : 'all';
  const visibleCourses = dash.courses.filter((c) => {
    const done = c.pct === 100 && c.totalLessons > 0;
    if (activeFilter === 'done') return done;
    if (activeFilter === 'progress') return !done;
    return true;
  });

  const filterTabs = [
    { id: 'all', label: he.myLearningAll, href: `/t/${slug}` },
    { id: 'progress', label: he.myLearningInProgress, href: `/t/${slug}?filter=progress` },
    { id: 'done', label: he.myLearningDone, href: `/t/${slug}?filter=done` },
  ] as const;
  const linkTabs = isStudent
    ? [
        { label: he.wishlistTitle, href: `/t/${slug}/wishlist` },
        { label: he.certificatesTitle, href: `/t/${slug}/certificates` },
        { label: he.redeem, href: `/t/${slug}/redeem` },
      ]
    : [];

  return (
    <div>
      {/* "My learning" band — full-bleed dark header with the filter tabs */}
      <section className="bg-brand-900 text-white -mt-8 mb-8 mx-[calc(50%-50vw)] px-[calc(50vw-50%)]">
        <div className="px-4 pt-10">
          <h1 className="font-display text-3xl sm:text-4xl font-bold">{he.myLearningTitle}</h1>
          <nav className="flex gap-6 mt-8 overflow-x-auto" aria-label={he.myLearningTitle}>
            {filterTabs.map((t) => (
              <Link
                key={t.id}
                href={t.href}
                className={cn(
                  'pb-3 text-base font-bold whitespace-nowrap border-b-4 transition-colors',
                  activeFilter === t.id ? 'border-white text-white' : 'border-transparent text-brand-300 hover:text-white',
                )}
              >
                {t.label}
              </Link>
            ))}
            {linkTabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="pb-3 text-base font-bold whitespace-nowrap border-b-4 border-transparent text-brand-300 hover:text-white transition-colors"
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {/* Course grid */}
      {!hasCourses ? (
        <EmptyState icon={<Icon name="book" size={22} />} title={he.noCourses} hint={he.noCoursesHint} />
      ) : visibleCourses.length === 0 ? (
        <EmptyState icon={<Icon name="book" size={22} />} title={he.noCourses} />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visibleCourses.map((course) => (
            <JourneyCourseCard
              key={course.id}
              slug={slug}
              course={course}
              coverUrl={coverUrl(course.coverPublicId)}
              schoolName={tenant.name}
            />
          ))}
        </div>
      )}

      {/* Personal stats */}
      {hp.showStats && hasCourses && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-12">
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

      {hp.showAchievements && hasCourses && <AchievementsStrip achievements={achievements} slug={slug} />}

      {/* Announcements + about the school */}
      {(hp.announcements.length > 0 || hp.aboutSchool) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 mt-10 items-start">
          {hp.announcements.length > 0 && <AnnouncementsCard announcements={hp.announcements} />}
          {hp.aboutSchool && (
            <Card className={hp.announcements.length === 0 ? 'lg:col-span-2' : undefined}>
              <CardBody>
                <div className="flex items-center gap-3 mb-3">
                  <Monogram name={tenant.name} tint={theme.soft} ink={theme.deep} />
                  <h2 className="font-display font-bold text-lg">
                    {he.aboutSchoolTitle} — {tenant.name}
                  </h2>
                </div>
                <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{hp.aboutSchool}</p>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Catalog — course cards in the same shape as the enrolled ones */}
      {hp.showCatalog && catalog.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline gap-3 mb-5">
            <h2 className="font-display text-2xl font-bold">{he.moreCourses}</h2>
            <span className="hidden sm:inline text-sm text-muted">{he.moreCoursesHint}</span>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {catalog.map((course) => {
              const m = parseMarketing(course.marketing);
              const t = LANDING_THEMES[m.accent];
              const featured = course.id === hp.featuredCourseId;
              return (
                <div key={course.id} className="group border border-line rounded-lg bg-card hover:shadow-lift transition-shadow flex flex-col">
                  <a href={`/t/${slug}/c/${course.id}`} className="block">
                    <div className="aspect-video border-b border-line rounded-t-lg grid place-items-center" style={{ background: t.soft }}>
                      <span className="text-5xl" aria-hidden>
                        {m.emoji}
                      </span>
                    </div>
                  </a>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="flex items-start gap-2">
                      <a href={`/t/${slug}/c/${course.id}`} className="flex-1 min-w-0">
                        <h3 className="font-body font-bold text-base leading-snug line-clamp-2 text-ink">
                          {m.headline || course.title}
                        </h3>
                      </a>
                      {isStudent && <WishlistButton courseId={course.id} initialSaved={wishlistIds.has(course.id)} />}
                    </div>
                    <p className="text-xs text-muted mt-1 truncate">{tenant.name}</p>
                    <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                      {m.priceText ? (
                        <span className="font-bold text-ink tabular-nums">{m.priceText}</span>
                      ) : (
                        <span className="text-sm font-bold text-copper-700">{he.viewCourse}</span>
                      )}
                      {featured && <Badge tone="copper">{he.featuredCourse}</Badge>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
