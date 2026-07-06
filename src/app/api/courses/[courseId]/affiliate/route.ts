import { NextResponse } from 'next/server';
import { requireAuth, forbidden } from '@/lib/auth/guards';
import { apiError } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { coinsFor, generateAffiliateCode, visitsPerCoin } from '@/lib/affiliates';

type Params = { params: Promise<{ courseId: string }> };

/**
 * Get-or-create the calling student's affiliate share link for a course
 * they're enrolled in (i.e. bought), plus their visit/coin stats.
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['STUDENT'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;

  const db = forTenant(auth.tenantId!);
  const course = await db.course.findFirst({ where: { id: courseId } });
  if (!course) return apiError(404, 'not_found');

  const enrolled = await db.enrollment.findFirst({
    where: { studentId: auth.userId, courseId },
  });
  if (!enrolled) return forbidden('not_enrolled');

  let link = await db.affiliateLink.findFirst({
    where: { courseId, studentId: auth.userId },
  });
  if (!link) {
    link = await db.affiliateLink.create({
      data: {
        tenantId: auth.tenantId!,
        courseId,
        studentId: auth.userId,
        code: generateAffiliateCode(),
      },
    });
  }

  return NextResponse.json({
    code: link.code,
    url: `${process.env.APP_URL ?? ''}/t/${auth.tenantSlug}/c/${courseId}?ref=${link.code}`,
    visits: link.visits,
    coins: coinsFor(link.visits),
    visitsPerCoin: visitsPerCoin(),
  });
}
