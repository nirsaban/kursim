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
 * An unknown email answers `found: false` so the form can say "no account
 * with this address in this school" — a product decision that trades away
 * strict anti-enumeration for less user confusion (email is per-school here,
 * and people routinely try the wrong school). Probing stays bounded by the
 * per-IP and per-email rate limits, which answer a generic success so the
 * limiter itself can't be used as an oracle. Mail outages also answer
 * success: the address was real, retrying won't help the visitor.
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

  const ok = () => NextResponse.json({ ok: true, found: true });
  const notFound = () => NextResponse.json({ ok: true, found: false });

  const [byIp, byEmail] = await Promise.all([
    rateLimit('forgot-ip', clientIp(req), FORGOT_LIMIT),
    rateLimit('forgot-email', `${tenantSlug}:${normalizedEmail}`, FORGOT_LIMIT),
  ]);
  if (!byIp.allowed || !byEmail.allowed) return ok();

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant || tenant.status !== 'ACTIVE') return notFound();

  const db = forTenant(tenant.id);
  const user = await db.user.findFirst({ where: { email: normalizedEmail } });
  // Synthesised @kursim.local logins (Apple Pay buyers with no email) have no
  // real inbox to send to — they recover through the school owner instead.
  if (!user || user.status !== 'ACTIVE' || !isRealEmail(user.email)) return notFound();

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
  const mail = await sendMail({
    to: user.email,
    subject: he.mailResetSubject,
    text: he.mailResetBody.replace('{url}', link).replace('{support}', he.supportPhone),
  });
  // Server-side only — makes an SMTP outage debuggable without weakening
  // what the visitor can observe.
  if (!mail.ok) console.warn(`[forgot] reset mail failed (${tenant.slug}): ${mail.error}`);

  return ok();
}
