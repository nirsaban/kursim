import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { listLiveSessions } from '@/lib/session-registry/registry';

/** Tenant-wide "who's connected now" for the owner panel. */
export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;

  const db = forTenant(auth.tenantId!);
  const users = await db.user.findMany({
    where: { role: { in: ['STUDENT', 'INSTRUCTOR'] } },
    select: { id: true, email: true, role: true },
  });

  const sessions = (
    await Promise.all(
      users.map(async (u) =>
        (await listLiveSessions(u.id)).map((s) => ({
          sid: s.sid,
          userId: u.id,
          email: u.email,
          role: u.role,
          deviceLabel: s.deviceLabel,
          ip: s.ip,
          createdAt: s.createdAt,
          lastSeenAt: s.lastSeenAt,
        })),
      ),
    )
  ).flat();

  sessions.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  return NextResponse.json({ sessions });
}
