import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseMarketing } from '@/lib/validation/marketing';
import { LANDING_THEMES } from '@/lib/landing-themes';
import { formatAgorot } from '@/lib/money';
import CheckoutForm from '@/components/CheckoutForm';
import { he } from '@/lib/he';

type Params = { params: Promise<{ slug: string; courseId: string }> };

/**
 * Buyer details before Hyp. Shows exactly what the payment covers — including
 * any bundled courses — so "one charge, two courses" is visible before paying
 * rather than a surprise in the confirmation.
 */
export default async function CheckoutPage({ params }: Params) {
  const { slug, courseId } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status !== 'ACTIVE') notFound();

  const db = forTenant(tenant.id);
  const course = await db.course.findFirst({
    where: { id: courseId },
    select: { id: true, title: true, priceAgorot: true, marketing: true },
  });
  if (!course) notFound();
  // No price means this course isn't sold through checkout at all.
  if (!course.priceAgorot || course.priceAgorot <= 0) notFound();

  const m = parseMarketing(course.marketing);
  const theme = LANDING_THEMES[m.accent];

  // Same resolution the start route does, purely for display here.
  const bundleIds = m.bundleCourseIds.filter((id) => id !== course.id);
  const extras = bundleIds.length
    ? await db.course.findMany({ where: { id: { in: bundleIds } }, select: { id: true, title: true } })
    : [];
  const included = [
    course.title,
    ...bundleIds.map((id) => extras.find((c) => c.id === id)?.title).filter(Boolean),
  ] as string[];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-paper">
      <div className="max-w-md w-full bg-card border border-line rounded-xl2 shadow-lift p-7 sm:p-8">
        <h1 className="font-display text-2xl font-black text-center">{he.checkoutTitle}</h1>
        <p className="text-muted text-sm mt-2 text-center leading-relaxed">{he.checkoutSubtitle}</p>

        <div className="mt-6 rounded-xl border border-line bg-paper p-4">
          <p className="text-xs font-semibold text-muted">{he.checkoutIncludes}</p>
          <ul className="mt-2 space-y-1.5">
            {included.map((title) => (
              <li key={title} className="flex items-start gap-2 text-sm font-medium">
                <span aria-hidden style={{ color: theme.main }}>
                  ✓
                </span>
                <span>{title}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between mt-4 pt-3 border-t border-line">
            <span className="text-sm text-muted">{he.checkoutTotal}</span>
            <span className="font-display text-xl font-black" style={{ color: theme.main }}>
              {formatAgorot(course.priceAgorot)}
            </span>
          </div>
        </div>

        <CheckoutForm slug={slug} courseId={course.id} accent={theme.main} />

        <div className="mt-5 text-center">
          <Link
            href={`/t/${slug}/c/${course.id}`}
            className="text-sm text-muted hover:text-ink underline"
          >
            {he.checkoutBackToCourse}
          </Link>
        </div>
      </div>
    </div>
  );
}
