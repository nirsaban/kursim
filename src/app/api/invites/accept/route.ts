import { NextResponse } from 'next/server';
import { apiError, clientIp, parseBody } from '@/lib/api';
import { acceptInviteSchema } from '@/lib/validation/schemas';
import { rateLimit, INVITE_LIMIT } from '@/lib/rate-limit';
import { asSuperAdmin, forTenant } from '@/lib/tenant/scoped-prisma';
import { prisma } from '@/lib/tenant/prisma';
import { hashInviteToken } from '@/lib/invites';
import { hashPassword } from '@/lib/auth/password';

/** Public endpoint: redeem an invite link into a new tenant account. */
export async function POST(req: Request) {
  const rl = await rateLimit('invite-accept', clientIp(req), INVITE_LIMIT);
  if (!rl.allowed) return apiError(429, 'too_many_attempts');

  const parsed = await parseBody(req, acceptInviteSchema);
  if ('error' in parsed) return parsed.error;
  const { token, email, password, name } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // Token lookup is cross-tenant by nature (the visitor has no session yet).
  const invite = await asSuperAdmin().invite.findFirst({
    where: { tokenHash: hashInviteToken(token) },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return apiError(400, 'invalid_invite');
  }
  if (invite.email && invite.email !== normalizedEmail) {
    return apiError(400, 'email_mismatch');
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: invite.tenantId } });
  if (!tenant || tenant.status !== 'ACTIVE') return apiError(400, 'invalid_invite');

  const db = forTenant(tenant.id);
  const existing = await db.user.findFirst({ where: { email: normalizedEmail } });
  if (existing) return apiError(409, 'email_taken');

  await db.user.create({
    data: {
      email: normalizedEmail,
      name,
      passwordHash: await hashPassword(password),
      role: invite.role,
      status: 'ACTIVE',
    },
  });
  await db.invite.update({
    where: { id: invite.id },
    data: { usedAt: new Date() },
  });

  return NextResponse.json({ ok: true, tenantSlug: tenant.slug }, { status: 201 });
}
