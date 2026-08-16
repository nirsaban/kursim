import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { prisma } from '@/lib/tenant/prisma';

/** Super-admin: the sales-lead pipeline, newest first. */
export async function GET() {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({ leads });
}
