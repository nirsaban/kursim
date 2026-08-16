import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { automationPatchSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  const parsed = await parseBody(req, automationPatchSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const existing = await db.emailAutomation.findFirst({ where: { id } });
  if (!existing) return apiError(404, 'not_found');

  await db.emailAutomation.updateMany({ where: { id }, data: parsed.data });
  const automation = await db.emailAutomation.findFirst({ where: { id } });
  return NextResponse.json({ automation });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  const db = forTenant(auth.tenantId!);
  const existing = await db.emailAutomation.findFirst({ where: { id } });
  if (!existing) return apiError(404, 'not_found');

  await db.emailAutomation.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
