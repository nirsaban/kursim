import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { resendSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { hashPassword } from '@/lib/auth/password';
import { sendWhatsappText } from '@/lib/whatsapp';
import { he } from '@/lib/he';

export const runtime = 'nodejs';

function tempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

type Params = { params: Promise<{ id: string }> };

/**
 * Resend a purchase's WhatsApp login. If the buyer never logged in
 * (mustChangePassword still true) we issue a fresh temp password; otherwise we
 * just resend the "log in with your existing account" message. An optional
 * phone override corrects a wrong number and is saved back to the purchase.
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, resendSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const purchase = await db.purchase.findFirst({ where: { id } });
  if (!purchase) return apiError(404, 'not_found');
  if (!purchase.provisionedUserId) return apiError(400, 'no_user');

  const phone = (parsed.data.phone ?? purchase.payerPhone ?? '').trim();
  if (!phone) return apiError(400, 'no_phone');

  const [user, course] = await Promise.all([
    db.user.findFirst({
      where: { id: purchase.provisionedUserId },
      select: { id: true, email: true, mustChangePassword: true },
    }),
    db.course.findFirst({ where: { id: purchase.courseId }, select: { title: true } }),
  ]);
  if (!user) return apiError(404, 'no_user');

  const loginUrl = `${process.env.APP_URL ?? ''}/t/${auth.tenantSlug}/login`;
  const name = purchase.payerName || user.email.split('@')[0];

  let message: string;
  if (user.mustChangePassword) {
    // Never set their own password → safe to reissue a fresh one.
    const pass = tempPassword();
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(pass), mustChangePassword: true },
    });
    message = he.waWelcomeNew
      .replace('{name}', name)
      .replace('{course}', course?.title ?? '')
      .replace('{url}', loginUrl)
      .replace('{email}', user.email)
      .replace('{pass}', pass);
  } else {
    message = he.waWelcomeExisting
      .replace('{name}', name)
      .replace('{course}', course?.title ?? '')
      .replace('{url}', loginUrl)
      .replace('{email}', user.email);
  }

  const result = await sendWhatsappText(auth.tenantId!, phone, message);
  await db.purchase.update({
    where: { id },
    data: {
      payerPhone: phone,
      delivered: result.ok,
      deliveryError: result.ok ? null : result.error ?? 'unknown',
    },
  });

  return NextResponse.json({ ok: result.ok, error: result.error ?? null });
}
