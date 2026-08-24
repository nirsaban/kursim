import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getTenantPlan } from '@/lib/billing-server';
import { canPublishLanding } from '@/lib/billing';

type Params = { params: Promise<{ collectionId: string }> };
const bodySchema = z.object({ published: z.boolean() });

/** Toggle a combined landing page — same plan gate as a course landing page. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { collectionId } = await params;
  const parsed = await parseBody(req, bodySchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const existing = await db.courseCollection.findFirst({ where: { id: collectionId } });
  if (!existing) return apiError(404, 'not_found');
  if (parsed.data.published) {
    const plan = await getTenantPlan(auth.tenantId!);
    if (!canPublishLanding(plan)) return apiError(402, 'plan_required', { plan });
  }
  await db.courseCollection.update({
    where: { id: collectionId },
    data: { published: parsed.data.published },
  });
  return NextResponse.json({ published: parsed.data.published });
}
