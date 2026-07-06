import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { createTenantSchema } from '@/lib/validation/schemas';
import { asSuperAdmin } from '@/lib/tenant/scoped-prisma';
import { prisma } from '@/lib/tenant/prisma';
import { hashPassword } from '@/lib/auth/password';

export async function GET() {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  const tenants = await asSuperAdmin().tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, courses: true } },
    },
  });
  return NextResponse.json({ tenants });
}

export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, createTenantSchema);
  if ('error' in parsed) return parsed.error;
  const { slug, name, ownerEmail, ownerPassword, sessionLimit, evictionPolicy } = parsed.data;

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) return apiError(409, 'slug_taken');

  const db = asSuperAdmin();
  const tenant = await db.tenant.create({
    data: { slug, name, sessionLimit, evictionPolicy },
  });
  await db.user.create({
    data: {
      tenantId: tenant.id,
      email: ownerEmail.toLowerCase(),
      passwordHash: await hashPassword(ownerPassword),
      role: 'OWNER',
      status: 'ACTIVE',
      mustChangePassword: true,
    },
  });
  return NextResponse.json({ tenant }, { status: 201 });
}
