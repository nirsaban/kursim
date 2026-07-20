import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';

type Params = { params: Promise<{ codeId: string }> };

/** Owner: revoke an access code — e.g. it leaked publicly and needs to stop working. */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { codeId } = await params;

  const db = forTenant(auth.tenantId!);
  const existing = await db.accessCode.findFirst({ where: { id: codeId } });
  if (!existing) return apiError(404, 'not_found');

  await db.accessCode.delete({ where: { id: codeId } });
  return NextResponse.json({ ok: true });
}
