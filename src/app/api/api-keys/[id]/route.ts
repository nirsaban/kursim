import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const db = forTenant(auth.tenantId!);
  const existing = await db.apiKey.findFirst({ where: { id } });
  if (!existing) return apiError(404, 'not_found');

  await db.apiKey.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
