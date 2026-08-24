import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { hashPassword } from '@/lib/auth/password';
import { sendWhatsappText } from '@/lib/whatsapp';
import { sendMail, isRealEmail } from '@/lib/email';
import { notify } from '@/lib/notify';
import { captureRawCallback, parseGrowBody, paidSignal } from '@/lib/pay/grow-callback';
import { he } from '@/lib/he';
import { buildSupportLines } from '@/lib/pay/provision';

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
  await captureRawCallback('pay:grow:log', {
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
  const { paid, transactionId } = paidSignal(body);
  if (!paid) return NextResponse.json({ ignored: true }, { status: 200 });
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
    select: { id: true, title: true, catalogNumber: true },
  });
  // Keep the order the link declared, so the first course stays the primary one.
  const listed = requestedIds
    .map((id) => found.find((c) => c.id === id))
    .filter((c): c is { id: string; title: string; catalogNumber: number } => Boolean(c));

  /**
   * Does this Grow line item identify this course? The owner puts the course's
   * catalog number in the product's "catalog_number" field; links written
   * before catalog numbers existed carry the raw course UUID there instead, so
   * accept either. Anything else — blank, or a number from another tenant's
   * catalog — matches nothing.
   */
  const identifies = (product: Record<string, string>, course: (typeof listed)[number]) => {
    const tag = String(product.catalog_number ?? '').trim();
    if (!tag) return false;
    return tag === course.id || tag === String(course.catalogNumber);
  };

  // Honour what the buyer actually bought. The callback fires once whether they
  // took one product or the whole bundle, so these tags are the only signal that
  // tells a partial purchase from a full one.
  const tagged = products.filter((pr) => listed.some((c) => identifies(pr, c)));
  const untagged = tagged.length === 0;
  const granted = untagged
    ? // Nothing identifiable: fall back to granting the whole link, because a
      // paid buyer must never be left with nothing. Flagged to the owner below.
      listed
    : listed.filter((c) =>
        tagged.some((pr) => identifies(pr, c) && Number(pr.quantity ?? '1') > 0),
      );
  // Only ambiguous when the link sells more than one course — a single-course
  // link grants the same thing tagged or not.
  const ambiguousGrant = untagged && listed.length > 1;

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
  const supportLine = await buildSupportLines(tenant.id);
  const message = `${waTemplate
    .replace('{name}', name)
    .replace('{course}', titles[0])
    .replace('{courses}', courseBullets)
    .replace('{url}', loginUrl)
    .replace('{email}', payerEmail)
    .replace('{pass}', plainPassword ?? '')}\n\n${supportLine}`;
  const delivery = payerPhone
    ? await sendWhatsappText(tenant.id, payerPhone, message)
    : { ok: false, error: 'no_phone' };

  const purchase = await db.purchase.create({
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
    select: { id: true },
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
    // A multi-course link whose products carry no recognisable catalog number
    // just gave away everything it lists. That's a silent revenue leak, so say
    // so loudly rather than letting it look like a normal sale.
    if (ambiguousGrant) {
      await Promise.all(
        owners.map((o) =>
          notify(db, tenant.id, {
            userId: o.id,
            type: 'enroll',
            title: he.saleUntaggedTitle,
            body: he.saleUntaggedBody.replace('{courses}', courseLine),
            link: `/t/${slug}/admin/courses`,
          }),
        ),
      );
    }
  } catch {
    // best-effort
  }

  // Email: a receipt to the buyer and a sale alert to the school's owners.
  // Strictly best-effort — the payment has already settled, so a mail outage
  // must never turn into a non-200 that makes Grow retry the whole callback.
  const mailed = { buyer: false, owners: 0 };
  let buyerMailError: string | null = 'not_attempted';
  try {
    if (isRealEmail(payerEmail)) {
      const mailTemplate = multi
        ? isNew
          ? he.mailBuyerNewMulti
          : he.mailBuyerExistingMulti
        : isNew
          ? he.mailBuyerNew
          : he.mailBuyerExisting;
      const buyerBody = `${mailTemplate
        .replace('{name}', name)
        .replace('{course}', titles[0])
        .replace('{courses}', courseBullets)
        .replace('{url}', loginUrl)
        .replace('{email}', payerEmail)
        .replace('{pass}', plainPassword ?? '')}\n\n${supportLine}`;
      const r = await sendMail({
        to: payerEmail,
        subject: he.mailBuyerSubject.replace('{course}', courseLine),
        text: buyerBody,
      });
      mailed.buyer = r.ok;
      buyerMailError = r.ok ? null : r.error;
    } else {
      // Synthesised @kursim.local login — there was never an address to mail.
      buyerMailError = 'no_real_email';
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
  } catch (err) {
    buyerMailError = err instanceof Error ? err.message : 'mail_failed';
  }

  // Record how the receipt actually went out. Without this the outcome lives
  // only in the response body below, which Grow discards — leaving no way to
  // answer "did the buyer ever get their email?" once the request is over.
  try {
    await db.purchase.update({
      where: { id: purchase.id },
      data: { mailedBuyer: mailed.buyer, mailError: buyerMailError },
    });
  } catch {
    // best-effort — never fail a settled payment over bookkeeping
  }

  return NextResponse.json(
    { ok: true, provisioned: true, delivered: delivery.ok, mailed },
    { status: 200 },
  );
}
