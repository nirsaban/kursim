import { NextResponse } from 'next/server';
import { asSuperAdmin, forTenant } from '@/lib/tenant/scoped-prisma';
import { getRedis } from '@/lib/redis';
import { hypCredentials, isPaid, verifyTransaction } from '@/lib/hyp/client';
import { provisionPurchase } from '@/lib/pay/provision';

export const runtime = 'nodejs';

/** Durable ring buffer of the last raw returns (read via redis: pay:hyp:log). */
async function captureReturn(entry: Record<string, unknown>): Promise<void> {
  try {
    const r = getRedis();
    await r.lpush('pay:hyp:log', JSON.stringify(entry));
    await r.ltrim('pay:hyp:log', 0, 49);
  } catch {
    /* diagnostics must never affect the response */
  }
}

/**
 * Hyp Pay completion redirect — where the buyer's browser lands after paying.
 *
 * This is ONE endpoint for the whole platform, because Hyp's success URL is a
 * terminal setting rather than a per-transaction parameter. Configure it once
 * in the Hyp portal as {APP_URL}/api/pay/hyp/return.
 *
 * Nothing here is trusted on sight. The query string is a URL the buyer's
 * browser was handed, so anyone could type it: we hand every parameter back to
 * Hyp via APISign/VERIFY and only believe the payment if Hyp confirms it, then
 * check the amount against what we intended to charge before granting access.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.search.replace(/^\?/, '');
  const q = url.searchParams;
  const orderId = (q.get('Order') ?? '').trim();
  const ccode = (q.get('CCode') ?? '').trim();

  await captureReturn({ at: Date.now(), raw: raw.slice(0, 2000) });

  const fail = (reason: string, slug?: string) =>
    NextResponse.redirect(
      new URL(`/t/${slug ?? ''}/pay/failed?reason=${encodeURIComponent(reason)}`, process.env.APP_URL ?? url.origin),
    );

  if (!orderId) return fail('no_order');

  // We don't know the tenant yet — the order id is the only thing that tells
  // us. This single lookup is therefore unscoped by necessity; every query
  // after it goes through the tenant-scoped client.
  const sa = asSuperAdmin();
  const order = await sa.paymentOrder.findFirst({ where: { id: orderId } });
  if (!order) return fail('unknown_order');

  const tenant = await sa.tenant.findFirst({
    where: { id: order.tenantId },
    select: { id: true, slug: true },
  });
  if (!tenant) return fail('unknown_tenant');

  const paidUrl = new URL(
    `/t/${tenant.slug}/c/${order.courseIds[0]}/thank-you`,
    process.env.APP_URL ?? url.origin,
  );

  // Already granted: a refresh of the return URL, or the buyer coming back.
  if (order.status === 'PAID') return NextResponse.redirect(paidUrl);

  const creds = hypCredentials();
  if (!creds) return fail('not_configured', tenant.slug);

  if (!isPaid(ccode)) {
    await sa.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'FAILED', ccode: ccode || 'missing', failureReason: 'ccode_not_paid' },
    });
    return fail(`ccode_${ccode || 'missing'}`, tenant.slug);
  }

  // The authenticity check: Hyp compares these parameters against their own
  // record of the transaction. Without it, the query string above is just
  // something a browser sent us.
  const verified = await verifyTransaction(creds, raw);
  if (!verified.ok) {
    await sa.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'FAILED', ccode: verified.ccode, failureReason: 'verify_failed' },
    });
    return fail('verify_failed', tenant.slug);
  }

  // Charged amount must match what we asked for. VERIFY already proves Hyp
  // agrees with these numbers, so a mismatch means the signed request differed
  // from our order — never grant a course for less than its price.
  const reported = Math.round(Number(q.get('Amount') ?? '0') * 100);
  if (!Number.isFinite(reported) || reported < order.amountAgorot) {
    await sa.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'FAILED', ccode, failureReason: `amount_mismatch:${q.get('Amount')}` },
    });
    return fail('amount_mismatch', tenant.slug);
  }

  const db = forTenant(tenant.id);
  const courses = await db.course.findMany({
    where: { id: { in: order.courseIds } },
    select: { id: true, title: true },
  });
  // Preserve the order's own ordering so the primary course stays primary.
  const ordered = order.courseIds
    .map((id) => courses.find((c) => c.id === id))
    .filter((c): c is { id: string; title: string } => Boolean(c));

  const transactionId = (q.get('Id') ?? '').trim() || `order-${order.id}`;
  const result = await provisionPurchase(db, {
    tenantId: tenant.id,
    slug: tenant.slug,
    courses: ordered,
    transactionId,
    provider: 'hyp',
    amount: q.get('Amount') ?? '',
    buyer: { email: order.buyerEmail, phone: order.buyerPhone, name: order.buyerName },
  });

  // Mark the order settled even when provisioning found a duplicate — the
  // money moved, and leaving it PENDING would make it look unpaid forever.
  await sa.paymentOrder.update({
    where: { id: order.id },
    data: {
      status: 'PAID',
      ccode,
      hypTransactionId: transactionId,
      completedAt: new Date(),
      failureReason: result.ok || result.reason === 'duplicate' ? null : (result.reason ?? null),
    },
  });

  return NextResponse.redirect(paidUrl);
}
