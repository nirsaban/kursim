import { NextResponse } from 'next/server';
import { prisma } from '@/lib/tenant/prisma';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { loadPackages } from '@/lib/billing-server';
import { PLANS, type Plan } from '@/lib/billing';
import { captureRawCallback, parseGrowBody, paidSignal } from '@/lib/pay/grow-callback';
import { sendMail, isRealEmail } from '@/lib/email';
import { sendPlatformWhatsapp } from '@/lib/platform-wa';
import { notify } from '@/lib/notify';
import { he } from '@/lib/he';

export const runtime = 'nodejs';

/** '₪99' / '99 ש"ח' → 99; null when no digits. */
function priceNumber(s: string): number | null {
  const m = s.replace(/[^\d.]/g, '');
  if (!m) return null;
  const n = Number(m);
  return Number.isFinite(n) ? n : null;
}

/**
 * Grow package webhook — ONE URL for all packages and every standing-order
 * cycle. Configure in Grow as the server callback of each package payment page:
 *   {APP_URL}/api/pay/plan?k={PLAN_WEBHOOK_SECRET}
 * (optionally &p=GROWTH to pin the package when a page's price is ambiguous).
 *
 * On each successful charge — the first payment and every recurring one — we:
 *   1. record a PlanPayment row (transactionId unique = idempotency),
 *   2. detect the package: the p param if given, else by matching the charged
 *      amount against the configured package prices,
 *   3. match the payer email to exactly one ACTIVE school's OWNER,
 *   4. set the school's plan and re-stamp planActivatedAt (so every cycle
 *      confirms the school is paying), notify the owner in-app + email,
 *      and WhatsApp the platform admin.
 * Anything unmatched is recorded with null tenant/plan and alerts the admin
 * for manual handling on the super-admin packages page.
 * Always returns 200 on handled cases so Grow does not retry-storm.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('k');
  const secret = process.env.PLAN_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  if (!key || key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const pinned = url.searchParams.get('p')?.toUpperCase() ?? '';

  const contentType = req.headers.get('content-type') ?? '';
  const rawBody = await req.text().catch(() => '');
  await captureRawCallback('pay:plan:log', {
    at: Date.now(),
    ip: req.headers.get('x-forwarded-for') ?? '',
    p: pinned,
    ct: contentType,
    raw: rawBody.slice(0, 4000),
  });

  const { fields } = parseGrowBody(rawBody, contentType);
  const { paid, transactionId } = paidSignal(fields);
  if (!paid) return NextResponse.json({ ignored: true }, { status: 200 });
  if (!transactionId) return NextResponse.json({ error: 'no_transaction' }, { status: 200 });

  const payerEmail = String(fields.payerEmail || '').trim().toLowerCase();
  const payerName = String(fields.fullName || '').trim();
  const amount = String(fields.paymentSum || fields.sum || '').trim();

  // Package: pinned param wins; else the charged amount must match exactly one
  // configured package price.
  let plan: Plan | null =
    pinned && PLANS.includes(pinned as Plan) && pinned !== 'FREE' ? (pinned as Plan) : null;
  if (!plan) {
    const packages = await loadPackages();
    const paidAmount = priceNumber(amount);
    const matches =
      paidAmount === null
        ? []
        : packages.filter((p) => priceNumber(p.priceMonthly) === paidAmount);
    if (matches.length === 1) plan = matches[0].plan;
  }

  // School: the payer email must belong to exactly one ACTIVE school's owner.
  const owners =
    payerEmail && isRealEmail(payerEmail)
      ? await prisma.user.findMany({
          where: {
            role: 'OWNER',
            status: 'ACTIVE',
            email: payerEmail,
            tenant: { status: 'ACTIVE' },
          },
          select: { id: true, tenantId: true, tenant: { select: { slug: true, name: true } } },
        })
      : [];
  const owner = owners.length === 1 ? owners[0] : null;
  const matched = owner && plan ? owner : null;

  // Idempotency: the unique transactionId makes standing-order retries no-ops.
  try {
    await prisma.planPayment.create({
      data: {
        tenantId: matched?.tenantId ?? null,
        plan: matched ? plan : null,
        amount,
        payerEmail,
        payerName,
        transactionId,
      },
    });
  } catch (err) {
    const dup = err instanceof Error && 'code' in err && (err as { code?: string }).code === 'P2002';
    if (dup) return NextResponse.json({ duplicate: true }, { status: 200 });
    throw err;
  }

  if (!matched) {
    console.warn(
      `[pay/plan] unmatched payment ${transactionId}: email=${payerEmail} plan=${plan ?? '?'} owners=${owners.length}`,
    );
    if (process.env.PLATFORM_ADMIN_PHONE) {
      await sendPlatformWhatsapp(
        process.env.PLATFORM_ADMIN_PHONE,
        he.planWebhookAdminUnmatched
          .replace('{email}', payerEmail || '?')
          .replace('{amount}', amount || '?'),
      );
    }
    return NextResponse.json({ recorded: true, matched: false }, { status: 200 });
  }

  await prisma.tenant.update({
    where: { id: matched.tenantId! },
    data: { plan: plan!, planActivatedAt: new Date() },
  });

  const paymentCount = await prisma.planPayment.count({ where: { tenantId: matched.tenantId } });
  const planName = he[`plan${plan![0]}${plan!.slice(1).toLowerCase()}` as 'planStarter'] ?? plan!;

  // Best-effort notifications — the activation above is already durable.
  await notify(forTenant(matched.tenantId!), matched.tenantId!, {
    userId: matched.id,
    type: 'plan',
    title: he.notifPlanActivatedTitle.replace('{plan}', planName),
    body: he.notifPlanActivatedBody,
    link: `/t/${matched.tenant!.slug}/admin/plan`,
  }).catch(() => {});
  if (isRealEmail(payerEmail)) {
    await sendMail({
      to: payerEmail,
      subject: he.mailPlanActivatedSubject.replace('{plan}', planName),
      text: he.mailPlanActivatedBody
        .replace('{plan}', planName)
        .replace('{school}', matched.tenant!.name)
        .replace('{link}', `${process.env.APP_URL ?? ''}/t/${matched.tenant!.slug}/admin/plan`),
    });
  }
  if (process.env.PLATFORM_ADMIN_PHONE) {
    await sendPlatformWhatsapp(
      process.env.PLATFORM_ADMIN_PHONE,
      he.planWebhookAdminOk
        .replace('{school}', matched.tenant!.name)
        .replace('{plan}', planName)
        .replace('{amount}', amount || '?')
        .replace('{count}', String(paymentCount)),
    );
  }

  return NextResponse.json({ recorded: true, matched: true, payments: paymentCount });
}
