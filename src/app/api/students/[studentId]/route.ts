import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { killAllSessions } from '@/lib/session-registry/registry';
import { z } from 'zod';

type Params = { params: Promise<{ studentId: string }> };

const patchSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { studentId } = await params;
  const parsed = await parseBody(req, patchSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const user = await db.user.findFirst({
    where: { id: studentId, role: { in: ['STUDENT', 'INSTRUCTOR'] } },
  });
  if (!user) return apiError(404, 'not_found');

  const updated = await db.user.update({
    where: { id: user.id },
    data: { status: parsed.data.status },
  });
  if (parsed.data.status === 'SUSPENDED') {
    await killAllSessions(user.id);
  }
  return NextResponse.json({
    student: { id: updated.id, email: updated.email, status: updated.status },
  });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { studentId } = await params;

  const db = forTenant(auth.tenantId!);
  const user = await db.user.findFirst({
    where: { id: studentId, role: { in: ['STUDENT', 'INSTRUCTOR'] } },
  });
  if (!user) return apiError(404, 'not_found');

  await killAllSessions(user.id);
  await db.user.delete({ where: { id: user.id } });
  return NextResponse.json({ ok: true });
}
