import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { listLiveSessions } from '@/lib/session-registry/registry';

type Params = { params: Promise<{ studentId: string }> };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { studentId } = await params;

  const db = forTenant(auth.tenantId!);
  const user = await db.user.findFirst({
    where: { id: studentId, role: { in: ['STUDENT', 'INSTRUCTOR'] } },
  });
  if (!user) return apiError(404, 'not_found');

  const sessions = await listLiveSessions(user.id);
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      sid: s.sid,
      deviceLabel: s.deviceLabel,
      ip: s.ip,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
    })),
  });
}
