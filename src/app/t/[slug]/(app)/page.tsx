import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseMarketing } from '@/lib/validation/marketing';
import PageHeader from '@/components/ui/PageHeader';
import ProgressBar from '@/components/ui/ProgressBar';
import EmptyState from '@/components/ui/EmptyState';
import { he } from '@/lib/he';

export default async function StudentHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role === 'OWNER' || auth.role === 'INSTRUCTOR') redirect(`/t/${slug}/admin`);

  const db = forTenant(auth.tenantId!);
  const enrollments = await db.enrollment.findMany({
    where: { studentId: auth.userId },
    include: {
      course: {
        include: { modules: { include: { lessons: { select: { id: true } } } } },
      },
    },
  });
  const courses = enrollments.map((e) => e.course).filter((c) => c.status === 'PUBLISHED');

  const progress = await db.progress.findMany({
    where: { studentId: auth.userId, completedAt: { not: null } },
    select: { lessonId: true },
  });
  const completedIds = new Set(progress.map((p) => p.lessonId));

  // Catalog: published courses with a public landing page the student can join.
  const enrolledIds = new Set(enrollments.map((e) => e.course.id));
  const catalog = (
    await db.course.findMany({
      where: { status: 'PUBLISHED', landingPublished: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, description: true, marketing: true },
    })
  ).filter((c) => !enrolledIds.has(c.id));

  return (
    <div>
      <PageHeader
        kicker={he.myCourses}
        title={`שלום 👋`}
        subtitle="ממשיכים מאיפה שעצרתם — ההתקדמות נשמרת אוטומטית"
      />

      {courses.length === 0 ? (
        <EmptyState
          icon="📚"
          title={he.noCourses}
          hint="ברגע שתירשמו לקורס — הוא יופיע כאן"
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
            const done = lessonIds.filter((id) => completedIds.has(id)).length;
            const pct = lessonIds.length ? Math.round((done / lessonIds.length) * 100) : 0;
            const emoji = parseMarketing(course.marketing).emoji;
            return (
              <Link
                key={course.id}
                href={`/t/${slug}/course/${course.id}`}
                className="group bg-white border border-line rounded-xl2 shadow-card hover:shadow-lift transition-shadow overflow-hidden"
              >
                <div className="h-24 bg-gradient-to-l from-brand-800 to-brand-600 flex items-end p-4">
                  <span className="w-11 h-11 rounded-xl bg-white shadow-card flex items-center justify-center text-2xl translate-y-8">
                    {emoji}
                  </span>
                </div>
                <div className="p-5 pt-10">
                  <h2 className="font-display font-bold text-lg group-hover:text-brand-700 transition-colors">
                    {course.title}
                  </h2>
                  {course.description && (
                    <p className="text-sm text-muted line-clamp-2 mt-1">{course.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted mt-4 mb-2">
                    <span>
                      {done}/{lessonIds.length} {he.lessons}
                    </span>
                    <span className="font-semibold text-brand-700 tabular-nums">{pct}%</span>
                  </div>
                  <ProgressBar value={pct} tone={pct === 100 ? 'ok' : 'brand'} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {catalog.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline gap-3 mb-5">
            <h2 className="font-display text-xl font-bold">{he.moreCourses}</h2>
            <span className="text-sm text-muted">{he.moreCoursesHint}</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((course) => {
              const m = parseMarketing(course.marketing);
              return (
                <a
                  key={course.id}
                  href={`/t/${slug}/c/${course.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-white border border-line rounded-xl2 shadow-card hover:shadow-lift transition-shadow p-5 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="w-11 h-11 rounded-xl bg-copper-100 flex items-center justify-center text-2xl shrink-0">
                      {m.emoji}
                    </span>
                    {m.priceText && (
                      <span className="text-sm font-display font-bold text-copper-700 bg-copper-50 rounded-full px-3 py-1">
                        {m.priceText}
                      </span>
                    )}
                  </div>
                  <h3 className="font-display font-bold text-lg mt-3 group-hover:text-brand-700 transition-colors">
                    {m.headline || course.title}
                  </h3>
                  {(m.subheadline || course.description) && (
                    <p className="text-sm text-muted line-clamp-2 mt-1">
                      {m.subheadline || course.description}
                    </p>
                  )}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-copper-700">
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
