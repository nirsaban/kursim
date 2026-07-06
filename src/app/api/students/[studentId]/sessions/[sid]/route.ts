import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getSession, evictSession } from '@/lib/session-registry/registry';

type Params = { params: Promise<{ studentId: string; sid: string }> };

/** Owner kills one of a student's live sessions — takes effect instantly. */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { studentId, sid } = await params;

  const db = forTenant(auth.tenantId!);
  const user = await db.user.findFirst({
    where: { id: studentId, role: { in: ['STUDENT', 'INSTRUCTOR'] } },
  });
  if (!user) return apiError(404, 'not_found');

  const session = await getSession(sid);
  if (!session || session.userId !== user.id) return apiError(404, 'not_found');

  await evictSession(sid);
  return NextResponse.json({ ok: true });
}
