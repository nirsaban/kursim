import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseMarketing } from '@/lib/validation/marketing';
import { getWhatsappState } from '@/lib/whatsapp';
import { hypCredentials } from '@/lib/hyp/client';
import { formatAgorot } from '@/lib/money';
import PageHeader from '@/components/ui/PageHeader';
import PaymentsPanel, { PaymentCourse, PurchaseRow } from '@/components/admin/PaymentsPanel';
import { he } from '@/lib/he';

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}`);
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const db = forTenant(tenant.id);
  const base = process.env.APP_URL ?? '';

  const rawCourses = await db.course.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, priceAgorot: true, marketing: true },
  });
  const titleById = new Map(rawCourses.map((c) => [c.id, c.title]));
  const courses: PaymentCourse[] = rawCourses.map((c) => {
    const m = parseMarketing(c.marketing);
    return {
      id: c.id,
      title: c.title,
      priceLabel: c.priceAgorot && c.priceAgorot > 0 ? formatAgorot(c.priceAgorot) : null,
      // What the buyer gets besides this course — the bundle, named.
      bundleTitles: m.bundleCourseIds
        .filter((id) => id !== c.id)
        .map((id) => titleById.get(id))
        .filter((t): t is string => Boolean(t)),
      checkoutUrl: `${base}/t/${slug}/c/${c.id}/checkout`,
      thankYouUrl: `${base}/t/${slug}/c/${c.id}/thank-you`,
    };
  });

  const rawPurchases = await db.purchase.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const purchases: PurchaseRow[] = rawPurchases.map((p) => ({
    id: p.id,
    payerName: p.payerName,
    payerEmail: p.payerEmail,
    payerPhone: p.payerPhone,
    courseTitle:
      (p.courseIds.length ? p.courseIds : [p.courseId])
        .map((id) => titleById.get(id))
        .filter(Boolean)
        .join(' + ') || '',
    amount: p.amount,
    delivered: p.delivered,
    isNewUser: p.isNewUser,
    canResend: Boolean(p.provisionedUserId),
    createdAt: p.createdAt.toISOString(),
  }));

  const wa = await getWhatsappState(tenant.id);

  return (
    <div>
      <PageHeader title={he.payments} subtitle={he.paymentsSubtitle} />
      <PaymentsPanel
        courses={courses}
        whatsappOn={wa.connected}
        hypOn={Boolean(hypCredentials())}
        purchases={purchases}
      />
    </div>
  );
}
