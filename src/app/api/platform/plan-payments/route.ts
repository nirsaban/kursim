import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { prisma } from '@/lib/tenant/prisma';

/** Super-admin: recent package payments (incl. standing-order cycles). */
export async function GET() {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;

  const rows = await prisma.planPayment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { tenant: { select: { name: true, slug: true } } },
  });
  // How many charges each school has paid in total — the standing-order counter.
  const counts = await prisma.planPayment.groupBy({
    by: ['tenantId'],
    _count: { _all: true },
    where: { tenantId: { not: null } },
  });
  const countByTenant = Object.fromEntries(counts.map((c) => [c.tenantId, c._count._all]));

  return NextResponse.json({
    payments: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      plan: r.plan,
      amount: r.amount,
      payerEmail: r.payerEmail,
      payerName: r.payerName,
      transactionId: r.transactionId,
      school: r.tenant ? { name: r.tenant.name, slug: r.tenant.slug } : null,
      totalForSchool: r.tenantId ? (countByTenant[r.tenantId] ?? 0) : 0,
    })),
  });
}
