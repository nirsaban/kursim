import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { priceOrder, resolveOffer } from '@/lib/pay/offer';
import { agorotToAmount, createPaymentPage, hypCredentials, splitFullName } from '@/lib/hyp/client';

export const runtime = 'nodejs';

const Body = z.object({
  slug: z.string().min(1).max(100),
  courseId: z.string().uuid(),
  email: z.string().email().max(200),
  phone: z.string().min(6).max(30),
  name: z.string().min(1).max(120),
  /** Optional extras the buyer ticked at checkout. Priced server-side. */
  addonCourseIds: z.array(z.string().uuid()).max(3).default([]),
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
 * The browser says WHICH course it wants — and which optional add-ons were
 * ticked — but what any of that costs is ours to decide, or a crafted request
 * would buy the catalogue for the price of one lesson.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const { slug, courseId, email, phone, name, addonCourseIds } = parsed.data;

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

  // What this purchase contains and costs — bundled courses, bundle pricing
  // and the priced add-ons the buyer may have ticked — all resolved from the
  // seller's own configuration through the tenant-scoped client.
  const offer = await resolveOffer(db, course);
  if (!offer) return NextResponse.json({ error: 'no_price' }, { status: 400 });

  // An add-on we don't recognise means the checkout page and this route
  // disagree about what's on sale (a stale tab, or a crafted request). Refuse
  // rather than charge for a basket we can't reproduce.
  const priced = priceOrder(offer, addonCourseIds);
  if (!priced) return NextResponse.json({ error: 'bad_addon' }, { status: 400 });
  const infoLine = priced.titles.join(' + ');

  const order = await db.paymentOrder.create({
    data: {
      tenantId: tenant.id,
      courseIds: priced.courseIds,
      amountAgorot: priced.totalAgorot,
      buyerEmail: email.trim().toLowerCase(),
      buyerPhone: phone.trim(),
      buyerName: name.trim(),
    },
    select: { id: true },
  });

  // We collect one "full name"; Hyp's page has a first and a last name field.
  const buyer = splitFullName(name);

  const signed = await createPaymentPage(creds, {
    Amount: agorotToAmount(priced.totalAgorot),
    Order: order.id,
    // Hyp shows `Info` on the payment page and the receipt; keep it short.
    Info: infoLine.slice(0, 150),
    heshDesc: infoLine.slice(0, 150),
    ClientName: buyer.first,
    ...(buyer.last ? { ClientLName: buyer.last } : {}),
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
