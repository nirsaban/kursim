import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { termsSchema, parseTerms } from '@/lib/validation/branding';
import { prisma } from '@/lib/tenant/prisma';

/** Owner reads/saves the academy terms gate. */
export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId! },
    select: { terms: true },
  });
  return NextResponse.json({ terms: parseTerms(tenant?.terms) });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, termsSchema);
  if ('error' in parsed) return parsed.error;

  await prisma.tenant.update({
    where: { id: auth.tenantId! },
    data: { terms: parsed.data },
  });
  return NextResponse.json({ terms: parsed.data });
}
