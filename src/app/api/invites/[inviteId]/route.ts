import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';

type Params = { params: Promise<{ inviteId: string }> };

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { inviteId } = await params;

  const db = forTenant(auth.tenantId!);
  const invite = await db.invite.findFirst({ where: { id: inviteId } });
  if (!invite) return apiError(404, 'not_found');

  await db.invite.delete({ where: { id: invite.id } });
  return NextResponse.json({ ok: true });
}
