import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { tenantSettingsSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/tenant/prisma';

export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId! },
    select: { slug: true, name: true, sessionLimit: true, evictionPolicy: true },
  });
  if (!tenant) return apiError(404, 'not_found');
  return NextResponse.json({ settings: tenant });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, tenantSettingsSchema);
  if ('error' in parsed) return parsed.error;

  const tenant = await prisma.tenant.update({
    where: { id: auth.tenantId! },
    data: parsed.data,
    select: { slug: true, name: true, sessionLimit: true, evictionPolicy: true },
  });
  return NextResponse.json({ settings: tenant });
}
