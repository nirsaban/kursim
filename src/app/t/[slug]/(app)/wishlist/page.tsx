import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseMarketing } from '@/lib/validation/marketing';
import { LANDING_THEMES } from '@/lib/landing-themes';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import WishlistButton from '@/components/WishlistButton';
import { he } from '@/lib/he';

export default async function WishlistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const db = forTenant(auth.tenantId!);
  const saved = await db.wishlist.findMany({
    where: { studentId: auth.userId },
    orderBy: { createdAt: 'desc' },
    select: { courseId: true },
  });
  const courseIds = saved.map((s) => s.courseId);
  const courses =
    courseIds.length > 0
      ? await db.course.findMany({
          where: { id: { in: courseIds }, status: 'PUBLISHED', landingPublished: true },
          select: { id: true, title: true, description: true, marketing: true },
        })
      : [];

  return (
    <div>
      <PageHeader title={he.wishlistTitle} />
      {courses.length === 0 ? (
        <EmptyState icon="🔖" title={he.wishlistEmpty} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const m = parseMarketing(course.marketing);
            const t = LANDING_THEMES[m.accent];
            return (
              <a
                key={course.id}
                href={`/t/${slug}/c/${course.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-card border border-line rounded-xl2 shadow-card hover:shadow-lift hover:-translate-y-1 transition-all duration-300 p-5 flex flex-col"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: t.soft }}
                  >
                    {m.emoji}
                  </span>
                  <WishlistButton courseId={course.id} initialSaved />
                </div>
                <h3 className="font-display font-bold text-lg mt-3">{m.headline || course.title}</h3>
                {(m.subheadline || course.description) && (
                  <p className="text-sm text-muted line-clamp-2 mt-1">
                    {m.subheadline || course.description}
                  </p>
                )}
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: t.main }}>
                  {he.viewCourse} ↗
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
