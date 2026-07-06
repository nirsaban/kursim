import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { reviewModerationSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

type Params = { params: Promise<{ reviewId: string }> };

/** Owner moderation: approve/hide, and optionally edit the published text/name/rating. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { reviewId } = await params;
  const parsed = await parseBody(req, reviewModerationSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const review = await db.courseReview.findFirst({ where: { id: reviewId } });
  if (!review) return apiError(404, 'not_found');

  const updated = await db.courseReview.update({
    where: { id: review.id },
    data: {
      ...(parsed.data.approved !== undefined ? { approved: parsed.data.approved } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.rating !== undefined ? { rating: parsed.data.rating } : {}),
      ...(parsed.data.text !== undefined ? { text: parsed.data.text.trim() } : {}),
    },
  });
  return NextResponse.json({ review: updated });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { reviewId } = await params;

  const db = forTenant(auth.tenantId!);
  const review = await db.courseReview.findFirst({ where: { id: reviewId } });
  if (!review) return apiError(404, 'not_found');

  await db.courseReview.delete({ where: { id: review.id } });
  return NextResponse.json({ ok: true });
}
