import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { updateTenantSchema } from '@/lib/validation/schemas';
import { asSuperAdmin } from '@/lib/tenant/scoped-prisma';
import { killAllSessions } from '@/lib/session-registry/registry';
import { destroyTenantPrefix } from '@/lib/cloudinary/cleanup';

type Params = { params: Promise<{ tenantId: string }> };

async function killTenantSessions(tenantId: string): Promise<void> {
  const users = await asSuperAdmin().user.findMany({
    where: { tenantId },
    select: { id: true },
  });
  for (const u of users) {
    await killAllSessions(u.id);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = await params;
  const parsed = await parseBody(req, updateTenantSchema);
  if ('error' in parsed) return parsed.error;

  const db = asSuperAdmin();
  const existing = await db.tenant.findFirst({ where: { id: tenantId } });
  if (!existing) return apiError(404, 'not_found');

  const tenant = await db.tenant.update({ where: { id: tenantId }, data: parsed.data });

  // Suspension takes effect immediately: every user of the tenant is logged out everywhere.
  if (parsed.data.status === 'SUSPENDED' && existing.status !== 'SUSPENDED') {
    await killTenantSessions(tenantId);
  }
  return NextResponse.json({ tenant });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  const { tenantId } = await params;

  const db = asSuperAdmin();
  const existing = await db.tenant.findFirst({ where: { id: tenantId } });
  if (!existing) return apiError(404, 'not_found');

  await killTenantSessions(tenantId);
  await db.tenant.delete({ where: { id: tenantId } });
  destroyTenantPrefix(tenantId).catch(() => {});
  return NextResponse.json({ ok: true });
}
