import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { moduleSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

type Params = { params: Promise<{ courseId: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;
  const parsed = await parseBody(req, moduleSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const course = await db.course.findFirst({ where: { id: courseId } });
  if (!course) return apiError(404, 'not_found');

  const maxSort = await db.module.aggregate({
    where: { courseId },
    _max: { sortOrder: true },
  });
  const created = await db.module.create({
    data: {
      tenantId: auth.tenantId!,
      courseId,
      title: parsed.data.title,
      sortOrder: parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json({ module: created }, { status: 201 });
}
