import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { brandingSchema, parseBranding } from '@/lib/validation/branding';
import { prisma } from '@/lib/tenant/prisma';

/** Owner reads/saves the tenant's branding (logo + accent color). */
export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId! },
    select: { branding: true, name: true },
  });
  return NextResponse.json({
    branding: parseBranding(tenant?.branding),
    tenantName: tenant?.name ?? '',
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, brandingSchema);
  if ('error' in parsed) return parsed.error;

  await prisma.tenant.update({
    where: { id: auth.tenantId! },
    data: { branding: parsed.data },
  });
  return NextResponse.json({ branding: parsed.data });
}
