import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseMarketing } from '@/lib/validation/marketing';
import { agorotToAmount, createPaymentPage, hypCredentials } from '@/lib/hyp/client';

export const runtime = 'nodejs';

const Body = z.object({
  slug: z.string().min(1).max(100),
  courseId: z.string().uuid(),
  email: z.string().email().max(200),
  phone: z.string().min(6).max(30),
  name: z.string().min(1).max(120),
});

/**
 * Start a Hyp checkout for a course, plus any courses bundled with it.
 *
 * We record the intended sale as a PaymentOrder BEFORE sending the buyer to
 * Hyp, and pass its id as Hyp's `Order`. That row is the only thing that makes
 * the completion redirect interpretable: Hyp's success URL is configured per
 * terminal, so the redirect arrives at one platform-wide endpoint with no idea
 * which tenant or course it belongs to.
 *
 * The price and the course list both come from the database, never the client.
 * The browser says WHICH course it wants; what that costs and what else it
 * unlocks are ours to decide, or a crafted request would buy the catalogue.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { slug, courseId, email, phone, name } = parsed.data;

  const creds = hypCredentials();
  if (!creds) return NextResponse.json({ error: 'not_configured' }, { status: 503 });

  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'tenant' }, { status: 404 });
  }

  const db = forTenant(tenant.id);
  const course = await db.course.findFirst({
    where: { id: courseId },
    select: { id: true, title: true, priceAgorot: true, status: true, marketing: true },
  });
  if (!course) return NextResponse.json({ error: 'course' }, { status: 404 });
  // A course with no price isn't sold through Hyp — don't invent one.
  if (!course.priceAgorot || course.priceAgorot <= 0) {
    return NextResponse.json({ error: 'no_price' }, { status: 400 });
  }

  // Courses this purchase also unlocks. Resolved here, from the seller's own
  // configuration, and filtered through the tenant-scoped client so a bundle
  // entry left behind by a deleted course simply drops out.
  const bundleIds = parseMarketing(course.marketing).bundleCourseIds.filter((id) => id !== course.id);
  const extras = bundleIds.length
    ? await db.course.findMany({ where: { id: { in: bundleIds } }, select: { id: true, title: true } })
    : [];
  // Keep the seller's declared order, primary course first.
  const granted = [
    { id: course.id, title: course.title },
    ...bundleIds.map((id) => extras.find((c) => c.id === id)).filter((c): c is { id: string; title: string } => Boolean(c)),
  ];
  const infoLine = granted.map((c) => c.title).join(' + ');

  const order = await db.paymentOrder.create({
    data: {
      tenantId: tenant.id,
      courseIds: granted.map((c) => c.id),
      amountAgorot: course.priceAgorot,
      buyerEmail: email.trim().toLowerCase(),
      buyerPhone: phone.trim(),
      buyerName: name.trim(),
    },
    select: { id: true },
  });

  const signed = await createPaymentPage(creds, {
    Amount: agorotToAmount(course.priceAgorot),
    Order: order.id,
    // Hyp shows `Info` on the payment page and the receipt; keep it short.
    Info: infoLine.slice(0, 150),
    heshDesc: infoLine.slice(0, 150),
    ClientName: name.trim(),
    email: email.trim(),
    cell: phone.trim(),
    PageLang: 'HEB',
  });

  if (!signed.ok) {
    await db.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'FAILED', ccode: signed.ccode, failureReason: signed.raw.slice(0, 500) },
    });
    return NextResponse.json({ error: 'sign_failed', ccode: signed.ccode }, { status: 502 });
  }

  return NextResponse.json({ url: signed.url, orderId: order.id });
}
