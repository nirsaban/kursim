import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { z } from 'zod';

type Params = { params: Promise<{ courseId: string }> };

const bodySchema = z.object({ published: z.boolean() });

/** Toggle the public landing page for a course. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;
  const parsed = await parseBody(req, bodySchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const existing = await db.course.findFirst({ where: { id: courseId } });
  if (!existing) return apiError(404, 'not_found');

  await db.course.update({
    where: { id: courseId },
    data: { landingPublished: parsed.data.published },
  });
  return NextResponse.json({ landingPublished: parsed.data.published });
}
