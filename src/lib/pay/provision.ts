import { randomBytes } from 'crypto';
import type { TenantClient } from '@/lib/tenant/scoped-prisma';
import { hashPassword } from '@/lib/auth/password';
import { sendWhatsappText } from '@/lib/whatsapp';
import { sendMail, isRealEmail } from '@/lib/email';
import { notify } from '@/lib/notify';
import { he } from '@/lib/he';

/**
 * Turning a settled payment into course access.
 *
 * Everything after "the money arrived" is identical whichever gateway took it:
 * create or reuse the student, enroll them, send their login over WhatsApp and
 * email, record the sale, and tell the school. Keeping it in one place is what
 * stops the Hyp and Grow paths from quietly drifting apart — a buyer must get
 * exactly the same treatment either way.
 *
 * Deciding WHICH courses were bought is the gateway's job, not this module's:
 * Grow infers it from product catalog numbers on the callback, Hyp reads it
 * off the PaymentOrder we created before redirecting.
 */

/** Readable 10-char temp password (no ambiguous characters). */
function tempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export interface ProvisionInput {
  tenantId: string;
  /** Tenant slug — only needed to build the login URL. */
  slug: string;
  /** Courses to grant, primary first. Must be non-empty and already verified. */
  courses: Array<{ id: string; title: string }>;
  /** The gateway's unique id for this charge — the idempotency key. */
  transactionId: string;
  provider: 'grow' | 'hyp';
  amount: string;
  buyer: { email: string; phone: string; name: string };
}

export interface ProvisionResult {
  ok: boolean;
  reason?: 'duplicate' | 'no_courses' | 'no_email';
  purchaseId?: string;
  userId?: string;
  isNewUser?: boolean;
  delivered?: boolean;
  mailedBuyer?: boolean;
}

/**
 * Grant access for a payment that has already been verified as settled.
 * Idempotent on `transactionId`, so a replayed callback — or a buyer who
 * refreshes the return URL — never provisions twice.
 */
export async function provisionPurchase(
  db: TenantClient,
  input: ProvisionInput,
): Promise<ProvisionResult> {
  const { tenantId, slug, courses, transactionId, provider, amount, buyer } = input;
  if (courses.length === 0) return { ok: false, reason: 'no_courses' };

  const seen = await db.purchase.findFirst({ where: { transactionId } });
  if (seen) return { ok: false, reason: 'duplicate', purchaseId: seen.id };

  const courseId = courses[0].id;
  const grantedIds = courses.map((c) => c.id);
  const titles = courses.map((c) => c.title);
  const multi = titles.length > 1;
  const courseLine = titles.join(' + ');
  const courseBullets = titles.map((t) => `• ${t}`).join('\n');

  // No identity means no account to grant access to. Record the sale anyway —
  // the money is real and the owner needs to see it — and stop.
  if (!buyer.email) {
    const orphan = await db.purchase.create({
      data: {
        tenantId,
        courseId,
        courseIds: grantedIds,
        transactionId,
        provider,
        payerEmail: '',
        payerPhone: buyer.phone,
        payerName: buyer.name,
        amount,
        delivered: false,
        deliveryError: 'no_email',
      },
      select: { id: true },
    });
    return { ok: false, reason: 'no_email', purchaseId: orphan.id };
  }

  // Reuse the account if this email already exists in this tenant.
  const existing = await db.user.findFirst({ where: { email: buyer.email }, select: { id: true } });
  let userId: string;
  let isNew = false;
  let plainPassword: string | null = null;
  if (existing) {
    userId = existing.id;
  } else {
    plainPassword = tempPassword();
    const created = await db.user.create({
      data: {
        tenantId,
        email: buyer.email,
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
    if (!enrolled) await db.enrollment.create({ data: { tenantId, studentId: userId, courseId: id } });
  }

  // Deliver credentials over WhatsApp.
  const loginUrl = `${process.env.APP_URL ?? ''}/t/${slug}/login`;
  const name = buyer.name || buyer.email.split('@')[0];
  const waTemplate = multi
    ? isNew
      ? he.waWelcomeNewMulti
      : he.waWelcomeExistingMulti
    : isNew
      ? he.waWelcomeNew
      : he.waWelcomeExisting;
  const supportLine = he.supportLine.replace('{phone}', he.supportPhone);
  const message = `${waTemplate
    .replace('{name}', name)
    .replace('{course}', titles[0])
    .replace('{courses}', courseBullets)
    .replace('{url}', loginUrl)
    .replace('{email}', buyer.email)
    .replace('{pass}', plainPassword ?? '')}\n\n${supportLine}`;
  const delivery = buyer.phone
    ? await sendWhatsappText(tenantId, buyer.phone, message)
    : { ok: false as const, error: 'no_phone' };

  const purchase = await db.purchase.create({
    data: {
      tenantId,
      courseId,
      courseIds: grantedIds,
      transactionId,
      provider,
      payerEmail: buyer.email,
      payerPhone: buyer.phone,
      payerName: buyer.name,
      amount,
      provisionedUserId: userId,
      isNewUser: isNew,
      delivered: delivery.ok,
      deliveryError: delivery.ok ? null : (delivery.error ?? 'unknown'),
    },
    select: { id: true },
  });

  // Alert the school's owners in-app.
  try {
    const owners = await db.user.findMany({
      where: { role: 'OWNER', status: 'ACTIVE' },
      select: { id: true },
    });
    await Promise.all(
      owners.map((o) =>
        notify(db, tenantId, {
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

  // Receipt to the buyer, sale alert to the owners. Strictly best-effort: the
  // payment has settled, so a mail outage must never become an error response
  // that makes the gateway retry the whole thing.
  const mailed = { buyer: false, owners: 0 };
  let buyerMailError: string | null = 'not_attempted';
  try {
    if (isRealEmail(buyer.email)) {
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
        .replace('{email}', buyer.email)
        .replace('{pass}', plainPassword ?? '')}\n\n${supportLine}`;
      const r = await sendMail({
        to: buyer.email,
        subject: he.mailBuyerSubject.replace('{course}', courseLine),
        text: buyerBody,
      });
      mailed.buyer = r.ok;
      buyerMailError = r.ok ? null : r.error;
    } else {
      buyerMailError = 'no_real_email';
    }

    const ownerBody = he.mailOwnerBody
      .replace('{course}', courseLine)
      .replace('{name}', name)
      .replace('{email}', buyer.email)
      .replace('{phone}', buyer.phone || '—')
      .replace('{amount}', amount || '—')
      .replace('{txn}', transactionId)
      .replace('{isNew}', isNew ? 'כן' : 'לא')
      .replace('{wa}', delivery.ok ? 'נשלח' : `נכשל (${delivery.ok ? '' : (delivery.error ?? 'unknown')})`)
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
            replyTo: isRealEmail(buyer.email) ? buyer.email : undefined,
          }),
        ),
    );
    mailed.owners = results.filter((r) => r.ok).length;
  } catch (err) {
    buyerMailError = err instanceof Error ? err.message : 'mail_failed';
  }

  try {
    await db.purchase.update({
      where: { id: purchase.id },
      data: { mailedBuyer: mailed.buyer, mailError: buyerMailError },
    });
  } catch {
    // best-effort — never fail a settled payment over bookkeeping
  }

  return {
    ok: true,
    purchaseId: purchase.id,
    userId,
    isNewUser: isNew,
    delivered: delivery.ok,
    mailedBuyer: mailed.buyer,
  };
}
