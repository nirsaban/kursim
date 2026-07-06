import { NextResponse } from 'next/server';
import { requireAuth, forbidden } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { courseSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { destroyCoursePrefix } from '@/lib/cloudinary/cleanup';

type Params = { params: Promise<{ courseId: string }> };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;
  const db = forTenant(auth.tenantId!);

  const course = await db.course.findFirst({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { sortOrder: 'asc' },
        include: {
          lessons: {
            orderBy: { sortOrder: 'asc' },
            include: { attachments: true },
          },
        },
      },
    },
  });
  if (!course) return apiError(404, 'not_found');

  if (auth.role === 'STUDENT') {
    if (course.status !== 'PUBLISHED') return apiError(404, 'not_found');
    const enrolled = await db.enrollment.findFirst({
      where: { studentId: auth.userId, courseId },
    });
    if (!enrolled) return forbidden('not_enrolled');
  }
  return NextResponse.json({ course });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;
  const parsed = await parseBody(req, courseSchema.partial());
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const existing = await db.course.findFirst({ where: { id: courseId } });
  if (!existing) return apiError(404, 'not_found');

  const course = await db.course.update({
    where: { id: courseId },
    data: parsed.data,
  });
  return NextResponse.json({ course });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;

  const db = forTenant(auth.tenantId!);
  const existing = await db.course.findFirst({ where: { id: courseId } });
  if (!existing) return apiError(404, 'not_found');

  await db.course.delete({ where: { id: courseId } });
  // Best-effort media cleanup; DB is already consistent if this fails.
  destroyCoursePrefix(auth.tenantId!, courseId).catch(() => {});
  return NextResponse.json({ ok: true });
}
