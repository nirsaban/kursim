import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseMarketing } from '@/lib/validation/marketing';
import { LANDING_THEMES } from '@/lib/landing-themes';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import Monogram from '@/components/ui/Monogram';
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
        <EmptyState icon={<Icon name="bookmark" size={22} />} title={he.wishlistEmpty} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const m = parseMarketing(course.marketing);
            const t = LANDING_THEMES[m.accent];
            return (
              <a
                key={course.id}
                href={`/t/${slug}/c/${course.id}`}
                className="group bg-card border border-line rounded-xl2 shadow-card hover:border-brand-300 hover:shadow-lift transition-[border-color,box-shadow] duration-200 p-5 flex flex-col"
              >
                <div className="flex items-start justify-between gap-3">
                  <Monogram name={m.headline || course.title} size="lg" tint={t.soft} ink={t.deep} />
                  <WishlistButton courseId={course.id} initialSaved />
                </div>
                <h3 className="font-display font-bold text-lg mt-4 leading-snug">
                  {m.headline || course.title}
                </h3>
                {(m.subheadline || course.description) && (
                  <p className="text-sm text-muted line-clamp-2 mt-1.5 leading-relaxed">
                    {m.subheadline || course.description}
                  </p>
                )}
                <span className="mt-4 pt-4 border-t border-line inline-flex items-center gap-1.5 text-sm font-semibold text-ink group-hover:text-brand-700 transition-colors">
                  {he.viewCourse}
                  <Icon name="arrowForward" size={15} className="text-muted" />
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
