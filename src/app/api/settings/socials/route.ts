import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { socialsSchema, parseSocials } from '@/lib/validation/links';
import { prisma } from '@/lib/tenant/prisma';

/** Owner reads/saves the school's social channels. */
export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId! },
    select: { socials: true },
  });
  return NextResponse.json({ socials: parseSocials(tenant?.socials) });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, socialsSchema);
  if ('error' in parsed) return parsed.error;

  await prisma.tenant.update({
    where: { id: auth.tenantId! },
    data: { socials: parsed.data },
  });
  return NextResponse.json({ socials: parsed.data });
}
