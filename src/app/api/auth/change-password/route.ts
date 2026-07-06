import { NextResponse } from 'next/server';
import { parseBody, apiError } from '@/lib/api';
import { changePasswordSchema } from '@/lib/validation/schemas';
import { getAuth, unauthorized } from '@/lib/auth/guards';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { forTenant, asSuperAdmin } from '@/lib/tenant/scoped-prisma';
import { listLiveSessions, evictSession } from '@/lib/session-registry/registry';

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const parsed = await parseBody(req, changePasswordSchema);
  if ('error' in parsed) return parsed.error;

  const db = auth.tenantId ? forTenant(auth.tenantId) : asSuperAdmin();
  const user = await db.user.findFirst({ where: { id: auth.userId } });
  if (!user) return unauthorized();

  if (!(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    return apiError(403, 'wrong_password');
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustChangePassword: false,
    },
  });

  // Kill every other session — a stolen device shouldn't survive a password change.
  const sessions = await listLiveSessions(user.id);
  for (const s of sessions) {
    if (s.sid !== auth.sid) await evictSession(s.sid);
  }

  return NextResponse.json({ ok: true });
}
