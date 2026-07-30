import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { hashPassword } from '@/lib/auth/password';
import { sendWhatsappText } from '@/lib/whatsapp';
import { sendMail, isRealEmail } from '@/lib/email';
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

/**
 * Some Grow payment pages nest every field under a `data` wrapper — form-encoded
 * as `data[statusCode]=2`, or JSON as `{"data":{...}}` — while others post the
 * same fields flat. Lift the wrapper so both shapes read identically downstream.
 * Deeper nesting (e.g. `data[productData][0][name]`) is not a field we consume
 * and is left untouched.
 */
function unwrapData(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (k: string, v: unknown) => {
    if (v === null || typeof v === 'object') return;
    out[k] = String(v);
  };
  for (const [k, v] of Object.entries(obj)) {
    const nested = /^data\[([^[\]]+)\]$/.exec(k);
    if (nested) {
      put(nested[1], v);
    } else if (k === 'data' && v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [ik, iv] of Object.entries(v as Record<string, unknown>)) put(ik, iv);
    } else {
      put(k, v);
    }
  }
  return out;
}

/**
 * Line items. A payment link that sells two courses posts two of these, as
 * `data[productData][0][...]` and `data[productData][1][...]` (or a JSON array).
 * `unwrapData` deliberately skips them, so pull them out separately.
 */
function extractProducts(obj: Record<string, unknown>): Array<Record<string, string>> {
  const byIndex = new Map<number, Record<string, string>>();
  const put = (i: number, k: string, v: unknown) => {
    if (v === null || typeof v === 'object') return;
    const row = byIndex.get(i) ?? {};
    row[k] = String(v);
    byIndex.set(i, row);
  };

  // Form-encoded: data[productData][0][name] — or the same without the wrapper.
  for (const [k, v] of Object.entries(obj)) {
    const m = /^(?:data\[productData\]|productData)\[(\d+)\]\[([^[\]]+)\]$/.exec(k);
    if (m) put(Number(m[1]), m[2], v);
  }

  // JSON: { productData: [...] } or { data: { productData: [...] } }.
  const wrapped = obj.data;
  const arrays = [
    Array.isArray(obj.productData) ? obj.productData : null,
    wrapped && typeof wrapped === 'object' && Array.isArray((wrapped as Record<string, unknown>).productData)
      ? ((wrapped as Record<string, unknown>).productData as unknown[])
      : null,
  ].filter(Boolean) as unknown[][];
  for (const arr of arrays) {
    arr.forEach((row, i) => {
      if (row && typeof row === 'object') {
        for (const [k, v] of Object.entries(row as Record<string, unknown>)) put(1000 + i, k, v);
      }
    });
  }

  return [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row);
}

/** Grow may POST JSON or form-encoded, flat or wrapped in `data`. Parse from the
 *  already-read raw text, trying JSON first then form, regardless of the
 *  declared content-type. */
function parseGrowBody(raw: string, ct: string): { fields: Record<string, string>; products: Array<Record<string, string>> } {
  const asForm = (s: string): Record<string, unknown> => {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of new URLSearchParams(s)) obj[k] = v;
    return obj;
  };
  const tryJson = (s: string): Record<string, unknown> | null => {
    try {
      const j = JSON.parse(s);
      return j && typeof j === 'object' ? (j as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const obj = (ct.includes('application/json') ? tryJson(raw) : null) ?? tryJson(raw) ?? asForm(raw);
  return { fields: unwrapData(obj), products: extractProducts(obj) };
}

/**
 * Grow payment webhook. Configure in Grow as the payment page's server callback:
 *   {APP_URL}/api/pay/grow?t={tenantSlug}&c={courseId}&k={tenant.webhookSecret}
 * `c` accepts a comma-separated list, so one payment link that sells several
 * products — one per course — grants all of them to the same buyer.
 * On a completed payment (statusCode "2") we provision the buyer as a student,
 * enroll them in every granted course, and WhatsApp their login. Idempotent on
 * transactionId.
 * Always returns 200 on handled cases so Grow does not retry-storm.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('t');
  const courseParam = url.searchParams.get('c');
  const key = url.searchParams.get('k');
  if (!slug || !courseParam || !key) return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  // A bundle link lists every course it sells: ...&c=id1,id2
  const requestedIds = [...new Set(courseParam.split(',').map((s) => s.trim()).filter(Boolean))];
  if (requestedIds.length === 0) return NextResponse.json({ error: 'missing_params' }, { status: 400 });

  // Read the raw body once and capture it durably, so we can see exactly what
  // Grow sends even when the parser doesn't recognise it as a completed payment.
  const contentType = req.headers.get('content-type') ?? '';
  const rawBody = await req.text().catch(() => '');
  await captureRawCallback({
    at: Date.now(),
    ip: req.headers.get('x-forwarded-for') ?? '',
    t: slug,
    c: courseParam,
    ct: contentType,
    raw: rawBody.slice(0, 4000),
  });

  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status !== 'ACTIVE') return NextResponse.json({ error: 'tenant' }, { status: 404 });
  if (!tenant.webhookSecret || key !== tenant.webhookSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { fields: body, products } = parseGrowBody(rawBody, contentType);
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

  const found = await db.course.findMany({
    where: { id: { in: requestedIds } },
    select: { id: true, title: true },
  });
  // Keep the order the link declared, so the first course stays the primary one.
  const listed = requestedIds
    .map((id) => found.find((c) => c.id === id))
    .filter((c): c is { id: string; title: string } => Boolean(c));

  // By default a bundle link grants everything it lists. If the owner tagged each
  // Grow product with its course id in "catalog_number", honour what the buyer
  // actually bought instead — that's the only way to tell a partial purchase from
  // a full one, since the callback fires once either way.
  const tagged = products.filter((pr) => requestedIds.includes(String(pr.catalog_number ?? '').trim()));
  const granted = tagged.length
    ? listed.filter((c) =>
        tagged.some(
          (pr) => String(pr.catalog_number).trim() === c.id && Number(pr.quantity ?? '1') > 0,
        ),
      )
    : listed;

  if (granted.length === 0) return NextResponse.json({ error: 'course' }, { status: 200 });
  const courseId = granted[0].id;
  const grantedIds = granted.map((c) => c.id);
  const titles = granted.map((c) => c.title);
  const multi = titles.length > 1;
  // Inline reference for subjects; bulleted list for message bodies.
  const courseLine = titles.join(' + ');
  const courseBullets = titles.map((t) => `• ${t}`).join('\n');

  // Idempotency: never process the same transaction twice.
  const seen = await db.purchase.findFirst({ where: { transactionId } });
  if (seen) return NextResponse.json({ duplicate: true }, { status: 200 });

  // Can't provision without an email identity — log the sale and stop.
  if (!payerEmail) {
    await db.purchase.create({
      data: {
        tenantId: tenant.id,
        courseId,
        courseIds: grantedIds,
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

  // Enroll in every granted course (idempotent per course).
  for (const id of grantedIds) {
    const enrolled = await db.enrollment.findFirst({ where: { studentId: userId, courseId: id } });
    if (!enrolled) {
      await db.enrollment.create({ data: { tenantId: tenant.id, studentId: userId, courseId: id } });
    }
  }

  // Deliver credentials over WhatsApp.
  const loginUrl = `${process.env.APP_URL ?? ''}/t/${slug}/login`;
  const name = payerName || payerEmail.split('@')[0];
  const waTemplate = multi
    ? isNew
      ? he.waWelcomeNewMulti
      : he.waWelcomeExistingMulti
    : isNew
      ? he.waWelcomeNew
      : he.waWelcomeExisting;
  const message = waTemplate
    .replace('{name}', name)
    .replace('{course}', titles[0])
    .replace('{courses}', courseBullets)
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
      courseIds: grantedIds,
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
          body: `${name} · ${courseLine}`,
          link: `/t/${slug}/admin/payments`,
        }),
      ),
    );
  } catch {
    // best-effort
  }

  // Email: a receipt to the buyer and a sale alert to the school's owners.
  // Strictly best-effort — the payment has already settled, so a mail outage
  // must never turn into a non-200 that makes Grow retry the whole callback.
  const mailed = { buyer: false, owners: 0 };
  try {
    if (isRealEmail(payerEmail)) {
      const mailTemplate = multi
        ? isNew
          ? he.mailBuyerNewMulti
          : he.mailBuyerExistingMulti
        : isNew
          ? he.mailBuyerNew
          : he.mailBuyerExisting;
      const buyerBody = mailTemplate
        .replace('{name}', name)
        .replace('{course}', titles[0])
        .replace('{courses}', courseBullets)
        .replace('{url}', loginUrl)
        .replace('{email}', payerEmail)
        .replace('{pass}', plainPassword ?? '');
      const r = await sendMail({
        to: payerEmail,
        subject: he.mailBuyerSubject.replace('{course}', courseLine),
        text: buyerBody,
      });
      mailed.buyer = r.ok;
    }

    const ownerBody = he.mailOwnerBody
      .replace('{course}', courseLine)
      .replace('{name}', name)
      .replace('{email}', payerEmail)
      .replace('{phone}', payerPhone || '—')
      .replace('{amount}', amount || '—')
      .replace('{txn}', transactionId)
      .replace('{isNew}', isNew ? 'כן' : 'לא')
      .replace('{wa}', delivery.ok ? 'נשלח' : `נכשל (${delivery.ok ? '' : delivery.error ?? 'unknown'})`)
      .replace('{link}', `${process.env.APP_URL ?? ''}/t/${slug}/admin/payments`);
    const ownerAccounts = await db.user.findMany({
      where: { role: 'OWNER', status: 'ACTIVE' },
      select: { email: true },
    });
    const results = await Promise.all(
      ownerAccounts
        .filter((o) => isRealEmail(o.email))
        .map((o) =>
          sendMail({
            to: o.email,
            subject: he.mailOwnerSubject.replace('{course}', courseLine),
            text: ownerBody,
            replyTo: isRealEmail(payerEmail) ? payerEmail : undefined,
          }),
        ),
    );
    mailed.owners = results.filter((r) => r.ok).length;
  } catch {
    // best-effort
  }

  return NextResponse.json(
    { ok: true, provisioned: true, delivered: delivery.ok, mailed },
    { status: 200 },
  );
}
