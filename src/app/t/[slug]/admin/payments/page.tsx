import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseMarketing } from '@/lib/validation/marketing';
import { getWhatsappState } from '@/lib/whatsapp';
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
  const secret = tenant.webhookSecret ?? '';

  const rawCourses = await db.course.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, marketing: true },
  });
  const courses: PaymentCourse[] = rawCourses.map((c) => {
    const m = parseMarketing(c.marketing);
    return {
      id: c.id,
      title: c.title,
      hasPaymentLink: Boolean(m.paymentLink),
      webhookUrl: `${base}/api/pay/grow?t=${slug}&c=${c.id}&k=${secret}`,
    };
  });

  const rawPurchases = await db.purchase.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const titleById = new Map(rawCourses.map((c) => [c.id, c.title]));
  const purchases: PurchaseRow[] = rawPurchases.map((p) => ({
    id: p.id,
    payerName: p.payerName,
    payerEmail: p.payerEmail,
    payerPhone: p.payerPhone,
    courseTitle: titleById.get(p.courseId) ?? '',
    amount: p.amount,
    delivered: p.delivered,
    isNewUser: p.isNewUser,
    canResend: Boolean(p.provisionedUserId),
    createdAt: p.createdAt.toISOString(),
  }));

  const wa = await getWhatsappState();

  return (
    <div>
      <PageHeader title={he.payments} subtitle={he.paymentsSubtitle} />
      <PaymentsPanel courses={courses} whatsappOn={wa.connected} purchases={purchases} />
    </div>
  );
}
