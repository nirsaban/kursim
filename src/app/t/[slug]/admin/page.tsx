import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import TiltCard from '@/components/fx/TiltCard';
import NavTile from '@/components/ui/NavTile';
import { ADMIN_SECTIONS } from '@/lib/admin-sections';
import { he } from '@/lib/he';

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  if (auth.role === 'OWNER') {
    return (
      <div>
        <PageHeader
          kicker={he.dashboard}
          title={he.adminOverviewTitle}
          subtitle={he.adminOverviewSubtitle}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {ADMIN_SECTIONS.map((s, i) => (
            <div key={s.key} className={`animate-rise rise-${i + 1}`}>
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
            className="inline-flex items-center bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold rounded-xl px-4 py-2 transition-colors"
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
