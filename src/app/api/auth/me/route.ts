import { NextResponse } from 'next/server';
import { getAuth, unauthorized } from '@/lib/auth/guards';
import { forTenant, asSuperAdmin } from '@/lib/tenant/scoped-prisma';

export async function GET() {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const db = auth.tenantId ? forTenant(auth.tenantId) : asSuperAdmin();
  const user = await db.user.findFirst({
    where: { id: auth.userId },
    select: { id: true, email: true, role: true, mustChangePassword: true },
  });
  if (!user) return unauthorized();
  return NextResponse.json({
    ...user,
    tenantSlug: auth.tenantSlug,
    sid: auth.sid,
  });
}
