import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';

/** Any authenticated user: their 30 most recent notifications + unread count. */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const db = forTenant(auth.tenantId!);
  const [notifications, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    db.notification.count({ where: { userId: auth.userId, readAt: null } }),
  ]);

  return NextResponse.json({ notifications, unread });
}

/** Mark every unread notification for the current user as read. */
export async function PATCH() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const db = forTenant(auth.tenantId!);
  await db.notification.updateMany({
    where: { userId: auth.userId, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
