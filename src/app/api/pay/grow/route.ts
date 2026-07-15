import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { hashPassword } from '@/lib/auth/password';
import { sendWhatsappText } from '@/lib/whatsapp';
import { notify } from '@/lib/notify';
import { getRedis } from '@/lib/redis';
import { he } from '@/lib/he';

/** Durable diagnostic ring buffer of the last raw callbacks (read via redis: pay:grow:log). */
async function captureRawCallback(entry: Record<string, unknown>): Promise<void> {
  try {
    const r = getRedis();
    await r.lpush('pay:grow:log', JSON.stringify(entry));
    await r.ltrim('pay:grow:log', 0, 49);
  } catch {
    /* diagnostics must never affect the response */
  }
}

// Node runtime: needs crypto + argon2 (not edge-compatible).
export const runtime = 'nodejs';

/** Readable 10-char temp password (no ambiguous characters). */
function tempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Grow may POST JSON or form-encoded. Parse from the already-read raw text,
 *  trying JSON first then form, regardless of the declared content-type. */
function parseGrowBody(raw: string, ct: string): Record<string, string> {
  const asForm = (s: string): Record<string, string> => {
    const obj: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(s)) obj[k] = v;
    return obj;
  };
  const tryJson = (s: string): Record<string, string> | null => {
    try {
      const j = JSON.parse(s);
      return j && typeof j === 'object' ? (j as Record<string, string>) : null;
    } catch {
      return null;
    }
  };
  if (ct.includes('application/json')) {
    const j = tryJson(raw);
    if (j) return j;
  }
  return tryJson(raw) ?? asForm(raw);
}

/**
 * Grow payment webhook. Configure in Grow as the payment page's server callback:
 *   {APP_URL}/api/pay/grow?t={tenantSlug}&c={courseId}&k={tenant.webhookSecret}
 * On a completed payment (statusCode "2") we provision the buyer as a student,
 * enroll them, and WhatsApp their login. Idempotent on transactionId.
 * Always returns 200 on handled cases so Grow does not retry-storm.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('t');
  const courseId = url.searchParams.get('c');
  const key = url.searchParams.get('k');
  if (!slug || !courseId || !key) return NextResponse.json({ error: 'missing_params' }, { status: 400 });

  // Read the raw body once and capture it durably, so we can see exactly what
  // Grow sends even when the parser doesn't recognise it as a completed payment.
  const contentType = req.headers.get('content-type') ?? '';
  const rawBody = await req.text().catch(() => '');
  await captureRawCallback({
    at: Date.now(),
    ip: req.headers.get('x-forwarded-for') ?? '',
    t: slug,
    c: courseId,
    ct: contentType,
    raw: rawBody.slice(0, 4000),
  });

  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status !== 'ACTIVE') return NextResponse.json({ error: 'tenant' }, { status: 404 });
  if (!tenant.webhookSecret || key !== tenant.webhookSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = parseGrowBody(rawBody, contentType);
  const statusCode = String(body.statusCode ?? '');
  const status = String(body.status ?? '');
  // Grow's Payment-Links webhook fires ONLY on a successful charge and signals it
  // with a reference number (asmachta) — there is no statusCode. Older/other Grow
  // formats use statusCode "2" / status "שולם". Accept any of these as paid.
  const asmachta = String(body.asmachta || '').trim();
  const transactionCode = String(body.transactionCode || '').trim();
  const paid = statusCode === '2' || status === 'שולם' || Boolean(asmachta || transactionCode);
  if (!paid) return NextResponse.json({ ignored: true }, { status: 200 });

  const transactionId = (asmachta || transactionCode || String(body.transactionId || '')).trim();
  if (!transactionId) return NextResponse.json({ error: 'no_transaction' }, { status: 200 });

  const payerPhone = String(body.payerPhone || '').trim();
  const payerName = String(body.fullName || '').trim();
  const amount = String(body.paymentSum || body.sum || '').trim();

  // Identity: prefer the buyer's email; if Grow didn't send one (e.g. Apple Pay),
  // fall back to a stable phone-derived login so we can still provision + WhatsApp.
  const rawEmail = String(body.payerEmail || '').trim().toLowerCase();
  const normPhone = payerPhone.replace(/\D/g, '');
  const payerEmail = rawEmail || (normPhone ? `wa-${normPhone}@kursim.local` : '');

  const db = forTenant(tenant.id);

  const course = await db.course.findFirst({ where: { id: courseId }, select: { id: true, title: true } });
  if (!course) return NextResponse.json({ error: 'course' }, { status: 200 });

  // Idempotency: never process the same transaction twice.
  const seen = await db.purchase.findFirst({ where: { transactionId } });
  if (seen) return NextResponse.json({ duplicate: true }, { status: 200 });

  // Can't provision without an email identity — log the sale and stop.
  if (!payerEmail) {
    await db.purchase.create({
      data: {
        tenantId: tenant.id,
        courseId,
        transactionId,
        payerEmail: '',
        payerPhone,
        payerName,
        amount,
        delivered: false,
        deliveryError: 'no_email',
      },
    });
    return NextResponse.json({ ok: true, provisioned: false }, { status: 200 });
  }

  // Provision: reuse the account if the email already exists in this tenant.
  const existing = await db.user.findFirst({ where: { email: payerEmail }, select: { id: true } });
  let userId: string;
  let isNew = false;
  let plainPassword: string | null = null;
  if (existing) {
    userId = existing.id;
  } else {
    plainPassword = tempPassword();
    const created = await db.user.create({
      data: {
        tenantId: tenant.id,
        email: payerEmail,
        passwordHash: await hashPassword(plainPassword),
        role: 'STUDENT',
        status: 'ACTIVE',
        mustChangePassword: true,
      },
      select: { id: true },
    });
    userId = created.id;
    isNew = true;
  }

  // Enroll (idempotent).
  const enrolled = await db.enrollment.findFirst({ where: { studentId: userId, courseId } });
  if (!enrolled) {
    await db.enrollment.create({ data: { tenantId: tenant.id, studentId: userId, courseId } });
  }

  // Deliver credentials over WhatsApp.
  const loginUrl = `${process.env.APP_URL ?? ''}/t/${slug}/login`;
  const name = payerName || payerEmail.split('@')[0];
  const message = (isNew ? he.waWelcomeNew : he.waWelcomeExisting)
    .replace('{name}', name)
    .replace('{course}', course.title)
    .replace('{url}', loginUrl)
    .replace('{email}', payerEmail)
    .replace('{pass}', plainPassword ?? '');
  const delivery = payerPhone
    ? await sendWhatsappText(tenant.id, payerPhone, message)
    : { ok: false, error: 'no_phone' };

  await db.purchase.create({
    data: {
      tenantId: tenant.id,
      courseId,
      transactionId,
      payerEmail,
      payerPhone,
      payerName,
      amount,
      provisionedUserId: userId,
      isNewUser: isNew,
      delivered: delivery.ok,
      deliveryError: delivery.ok ? null : delivery.error ?? 'unknown',
    },
  });

  // Alert the tenant's owners in-app.
  try {
    const owners = await db.user.findMany({ where: { role: 'OWNER', status: 'ACTIVE' }, select: { id: true } });
    await Promise.all(
      owners.map((o) =>
        notify(db, tenant.id, {
          userId: o.id,
          type: 'enroll',
          title: he.saleNotifyTitle,
          body: `${name} · ${course.title}`,
          link: `/t/${slug}/admin/payments`,
        }),
      ),
    );
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, provisioned: true, delivered: delivery.ok }, { status: 200 });
}
