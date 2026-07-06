import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { coinsFor, visitsPerCoin } from '@/lib/affiliates';

type Params = { params: Promise<{ courseId: string }> };

/** Owner view: every affiliate for this course with visits and earned coins. */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;

  const links = await forTenant(auth.tenantId!).affiliateLink.findMany({
    where: { courseId },
    orderBy: { visits: 'desc' },
    include: { student: { select: { email: true } } },
  });

  return NextResponse.json({
    visitsPerCoin: visitsPerCoin(),
    affiliates: links.map((l) => ({
      id: l.id,
      email: l.student.email,
      code: l.code,
      visits: l.visits,
      coins: coinsFor(l.visits),
      createdAt: l.createdAt,
    })),
  });
}
