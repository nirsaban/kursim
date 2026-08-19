import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { linktreeSchema, parseLinktree } from '@/lib/validation/links';
import { prisma } from '@/lib/tenant/prisma';

/** Owner reads/saves the school's LinkTree page config. */
export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId! },
    select: { linktree: true, slug: true },
  });
  return NextResponse.json({
    linktree: parseLinktree(tenant?.linktree),
    slug: tenant?.slug ?? '',
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, linktreeSchema);
  if ('error' in parsed) return parsed.error;

  await prisma.tenant.update({
    where: { id: auth.tenantId! },
    data: { linktree: parsed.data },
  });
  return NextResponse.json({ linktree: parsed.data });
}
