import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { redeemCodeSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

/** Student: redeem an access code to enroll for free in its course. */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['STUDENT'] });
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, redeemCodeSchema);
  if ('error' in parsed) return parsed.error;
  const code = parsed.data.code.trim().toUpperCase();

  const db = forTenant(auth.tenantId!);
  const accessCode = await db.accessCode.findFirst({ where: { code } });
  if (!accessCode) return apiError(404, 'redeemInvalid');
  if (accessCode.expiresAt && accessCode.expiresAt < new Date()) {
    return apiError(410, 'redeemInvalid');
  }
  if (accessCode.uses >= accessCode.maxUses) {
    return apiError(409, 'redeemInvalid');
  }

  const { courseId } = accessCode;

  const existing = await db.enrollment.findFirst({
    where: { studentId: auth.userId, courseId },
  });
  if (existing) {
    // Already enrolled — treat as success without double-enrolling or burning a use.
    return NextResponse.json({ courseId, ok: true });
  }

  await db.enrollment.create({
    data: { tenantId: auth.tenantId!, studentId: auth.userId, courseId },
  });
  await db.accessCode.updateMany({
    where: { id: accessCode.id },
    data: { uses: { increment: 1 } },
  });

  return NextResponse.json({ courseId, ok: true });
}
