import { NextResponse } from 'next/server';
import { apiError, clientIp, parseBody } from '@/lib/api';
import { resetWithTokenSchema } from '@/lib/validation/schemas';
import { rateLimit, RESET_LIMIT } from '@/lib/rate-limit';
import { asSuperAdmin, forTenant } from '@/lib/tenant/scoped-prisma';
import { prisma } from '@/lib/tenant/prisma';
import { hashAuthToken } from '@/lib/auth/tokens';
import { hashPassword } from '@/lib/auth/password';
import { listLiveSessions, evictSession } from '@/lib/session-registry/registry';

// Node runtime: needs crypto + argon2 (not edge-compatible).
export const runtime = 'nodejs';

/**
 * Self-serve password reset, step 2 of 2: redeem the emailed token.
 * Single-use and expiring; every failure mode collapses to `invalid_token` so
 * a caller can't tell an unknown token from an expired or already-spent one.
 */
export async function POST(req: Request) {
  const rl = await rateLimit('reset-ip', clientIp(req), RESET_LIMIT);
  if (!rl.allowed) return apiError(429, 'too_many_attempts');

  const parsed = await parseBody(req, resetWithTokenSchema);
  if ('error' in parsed) return parsed.error;
  const { token, password } = parsed.data;

  // Token lookup is cross-tenant by nature — the visitor has no session yet.
  const record = await asSuperAdmin().authToken.findFirst({
    where: { tokenHash: hashAuthToken(token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return apiError(400, 'invalid_token');
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: record.tenantId } });
  if (!tenant || tenant.status !== 'ACTIVE') return apiError(400, 'invalid_token');

  const db = forTenant(tenant.id);
  const user = await db.user.findFirst({ where: { id: record.userId } });
  if (!user || user.status !== 'ACTIVE') return apiError(400, 'invalid_token');

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      // They just proved control of the inbox and chose this password
      // themselves — there's nothing left to force on next login.
      mustChangePassword: false,
    },
  });
  await db.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  // A reset means "I lost control of this account" — drop every live session,
  // including any the previous holder still has open.
  for (const s of await listLiveSessions(user.id)) await evictSession(s.sid);

  return NextResponse.json({ ok: true, tenantSlug: tenant.slug });
}
