import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { trackCourseCheckoutView } from '@/lib/analytics/page-views';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseMarketing } from '@/lib/validation/marketing';
import { resolveOffer } from '@/lib/pay/offer';
import { LANDING_THEMES } from '@/lib/landing-themes';
import CheckoutForm from '@/components/CheckoutForm';
import { he } from '@/lib/he';

type Params = {
  params: Promise<{ slug: string; courseId: string }>;
  searchParams: Promise<{ addon?: string | string[] }>;
};

/**
 * Buyer details before Hyp. Shows exactly what the payment covers — bundled
 * courses included, optional add-ons ticked — so "one charge, two courses" is
 * visible before paying rather than a surprise in the confirmation.
 */
export default async function CheckoutPage({ params, searchParams }: Params) {
  const { slug, courseId } = await params;
  const sp = await searchParams;
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

  const theme = LANDING_THEMES[parseMarketing(course.marketing).accent];

  // The same resolution the start route runs, so what the buyer reads here is
  // what the payment page will charge.
  const offer = await resolveOffer(db, course);
  if (!offer) notFound();

  // A combined landing page may arrive with ?addon=<courseId> to pre-tick an
  // add-on. Only ids the offer already allows are honoured — anything else is
  // ignored, and the server prices the basket from its own data regardless.
  const wanted = new Set(Array.isArray(sp.addon) ? sp.addon : sp.addon ? [sp.addon] : []);
  const initialAddons = offer.addons.filter((a) => wanted.has(a.id)).map((a) => a.id);

  // Funnel step 2 (landing -> checkout). Unique per IP+UA, best-effort.
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  await trackCourseCheckoutView(tenant.id, courseId, ip, h.get('user-agent') ?? '').catch(() => {});

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-paper">
      <div className="max-w-md w-full bg-card border border-line rounded-xl2 shadow-lift p-7 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-center">{he.checkoutTitle}</h1>
        <p className="text-muted text-sm mt-2 text-center leading-relaxed">{he.checkoutSubtitle}</p>

        {/* Summary and total live inside the form: ticking an add-on changes
            both, so they have to re-render with the buyer's choices. */}
        <CheckoutForm
          slug={slug}
          courseId={course.id}
          accent={theme.main}
          offer={offer}
          initialAddons={initialAddons}
        />

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
