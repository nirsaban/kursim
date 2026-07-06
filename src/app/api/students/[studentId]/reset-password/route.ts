import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { resetPasswordSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { hashPassword } from '@/lib/auth/password';
import { killAllSessions } from '@/lib/session-registry/registry';

type Params = { params: Promise<{ studentId: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { studentId } = await params;
  const parsed = await parseBody(req, resetPasswordSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const user = await db.user.findFirst({
    where: { id: studentId, role: { in: ['STUDENT', 'INSTRUCTOR'] } },
  });
  if (!user) return apiError(404, 'not_found');

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      mustChangePassword: true,
    },
  });
  // A password reset invalidates every existing device.
  await killAllSessions(user.id);
  return NextResponse.json({ ok: true });
}
