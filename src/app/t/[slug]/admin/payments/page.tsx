import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseMarketing } from '@/lib/validation/marketing';
import { getWhatsappState } from '@/lib/whatsapp';
import { hypCredentials } from '@/lib/hyp/client';
import { formatAgorot } from '@/lib/money';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import PaymentsPanel, {
  PaymentCourse,
  PurchaseRow,
  AbandonedCheckoutRow,
} from '@/components/admin/PaymentsPanel';
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

  // ── revenue stats — over ALL purchases, not just the 50 shown ──
  // Gateways report the sum as a free-form shekel string ("299" / "299.00"),
  // so parse defensively and sum in agorot; an unparsable amount counts the
  // purchase but adds ₪0 rather than poisoning the total.
  const allPurchases = await db.purchase.findMany({
    select: { amount: true, isNewUser: true, createdAt: true },
  });
  const toAgorot = (raw: string): number => {
    const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  };
  const monthKey = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
    }).format(d);
  const thisMonth = monthKey(new Date());
  let totalAgorot = 0;
  let monthAgorot = 0;
  let monthCount = 0;
  let newStudents = 0;
  for (const p of allPurchases) {
    const agorot = toAgorot(p.amount);
    totalAgorot += agorot;
    if (p.isNewUser) newStudents++;
    if (monthKey(p.createdAt) === thisMonth) {
      monthAgorot += agorot;
      monthCount++;
    }
  }
  const purchaseCount = allPurchases.length;
  const avgAgorot = purchaseCount > 0 ? Math.round(totalAgorot / purchaseCount) : 0;
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

  // "Left before paying": a checkout that was started (Hyp sign call went out,
  // buyer details captured) but never got a completion callback at all — not
  // a card decline (that's FAILED), a true walk-away. The 30-minute floor
  // excludes buyers who are simply mid-checkout right now.
  const allCourseTitles = new Map(
    (await db.course.findMany({ select: { id: true, title: true } })).map((c) => [c.id, c.title]),
  );
  const rawAbandoned = await db.paymentOrder.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const abandoned: AbandonedCheckoutRow[] = rawAbandoned.map((o) => ({
    id: o.id,
    buyerName: o.buyerName,
    buyerEmail: o.buyerEmail,
    buyerPhone: o.buyerPhone,
    courseTitle: o.courseIds.map((id) => allCourseTitles.get(id)).filter(Boolean).join(' + ') || '',
    amount: formatAgorot(o.amountAgorot),
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader title={he.payments} subtitle={he.paymentsSubtitle} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard
          label={he.paymentsStatTotal}
          value={formatAgorot(totalAgorot)}
          sub={he.paymentsStatTotalSub}
          accent
        />
        <StatCard label={he.paymentsStatMonth} value={formatAgorot(monthAgorot)} />
        <StatCard
          label={he.paymentsStatCount}
          value={purchaseCount}
          sub={he.paymentsStatCountSub.replace('{n}', String(monthCount))}
        />
        <StatCard label={he.paymentsStatAvg} value={formatAgorot(avgAgorot)} sub={`${he.paymentsStatNewStudents}: ${newStudents}`} />
      </div>

      <PaymentsPanel
        courses={courses}
        whatsappOn={wa.connected}
        hypOn={Boolean(hypCredentials())}
        purchases={purchases}
        abandoned={abandoned}
      />
    </div>
  );
}
