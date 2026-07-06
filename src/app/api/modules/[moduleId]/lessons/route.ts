import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { lessonSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

type Params = { params: Promise<{ moduleId: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { moduleId } = await params;
  const parsed = await parseBody(req, lessonSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const parent = await db.module.findFirst({ where: { id: moduleId } });
  if (!parent) return apiError(404, 'not_found');

  const maxSort = await db.lesson.aggregate({
    where: { moduleId },
    _max: { sortOrder: true },
  });
  const lesson = await db.lesson.create({
    data: {
      tenantId: auth.tenantId!,
      moduleId,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      sortOrder: parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json({ lesson }, { status: 201 });
}
