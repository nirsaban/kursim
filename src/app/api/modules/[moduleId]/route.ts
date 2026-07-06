import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { moduleSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

type Params = { params: Promise<{ moduleId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { moduleId } = await params;
  const parsed = await parseBody(req, moduleSchema.partial());
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const existing = await db.module.findFirst({ where: { id: moduleId } });
  if (!existing) return apiError(404, 'not_found');

  const updated = await db.module.update({ where: { id: moduleId }, data: parsed.data });
  return NextResponse.json({ module: updated });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { moduleId } = await params;

  const db = forTenant(auth.tenantId!);
  const existing = await db.module.findFirst({ where: { id: moduleId } });
  if (!existing) return apiError(404, 'not_found');

  await db.module.delete({ where: { id: moduleId } });
  return NextResponse.json({ ok: true });
}
