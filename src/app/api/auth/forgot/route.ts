import { NextResponse } from 'next/server';
import { clientIp, parseBody } from '@/lib/api';
import { forgotPasswordSchema } from '@/lib/validation/schemas';
import { rateLimit, FORGOT_LIMIT } from '@/lib/rate-limit';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { generateAuthToken, RESET_TOKEN_TTL_MS } from '@/lib/auth/tokens';
import { sendMail, isRealEmail } from '@/lib/email';
import { he } from '@/lib/he';

// Node runtime: needs crypto (not edge-compatible).
export const runtime = 'nodejs';

/**
 * Self-serve password reset, step 1 of 2.
 *
 * Every path answers an identical 200 — unknown email, suspended account,
 * rate-limited, mail outage — so the endpoint can't be used to enumerate which
 * addresses have accounts here.
 *
 * The link is delivered to the account's *stored* email only. It is never sent
 * to a phone or address supplied at checkout: those fields come from the Grow
 * form and are attacker-controlled, so delivering recovery there would let
 * anyone reset a stranger's account by buying a course in their name.
 */
export async function POST(req: Request) {
  const parsed = await parseBody(req, forgotPasswordSchema);
  if ('error' in parsed) return parsed.error;
  const { email, tenantSlug } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  // The single response every branch below returns.
  const silent = () => NextResponse.json({ ok: true });

  const [byIp, byEmail] = await Promise.all([
    rateLimit('forgot-ip', clientIp(req), FORGOT_LIMIT),
    rateLimit('forgot-email', `${tenantSlug}:${normalizedEmail}`, FORGOT_LIMIT),
  ]);
  if (!byIp.allowed || !byEmail.allowed) return silent();

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant || tenant.status !== 'ACTIVE') return silent();

  const db = forTenant(tenant.id);
  const user = await db.user.findFirst({ where: { email: normalizedEmail } });
  // Synthesised @kursim.local logins (Apple Pay buyers with no email) have no
  // real inbox to send to — they recover through the school owner instead.
  if (!user || user.status !== 'ACTIVE' || !isRealEmail(user.email)) return silent();

  // One live reset link at a time: requesting a new one retires the old.
  await db.authToken.updateMany({
    where: { userId: user.id, kind: 'RESET', usedAt: null },
    data: { usedAt: new Date() },
  });

  const { token, tokenHash } = generateAuthToken();
  await db.authToken.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      kind: 'RESET',
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const link = `${process.env.APP_URL ?? ''}/t/${tenant.slug}/reset/${token}`;
  await sendMail({
    to: user.email,
    subject: he.mailResetSubject,
    text: he.mailResetBody.replace('{url}', link).replace('{support}', he.supportPhone),
  });

  return silent();
}
