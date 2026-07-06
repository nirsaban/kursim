import { NextResponse } from 'next/server';
import { requireAuth, forbidden } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { progressSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

export async function GET(req: Request) {
  const auth = await requireAuth({ roles: ['STUDENT'] });
  if (auth instanceof NextResponse) return auth;
  const courseId = new URL(req.url).searchParams.get('courseId');
  const db = forTenant(auth.tenantId!);
  const progress = await db.progress.findMany({
    where: {
      studentId: auth.userId,
      ...(courseId ? { lesson: { module: { courseId } } } : {}),
    },
    select: { lessonId: true, lastPositionSec: true, completedAt: true },
  });
  return NextResponse.json({ progress });
}

export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['STUDENT'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, progressSchema);
  if ('error' in parsed) return parsed.error;
  const { lessonId, lastPositionSec, completed } = parsed.data;

  const db = forTenant(auth.tenantId!);
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId },
    include: { module: true },
  });
  if (!lesson) return apiError(404, 'not_found');

  const enrolled = await db.enrollment.findFirst({
    where: { studentId: auth.userId, courseId: lesson.module.courseId },
  });
  if (!enrolled) return forbidden('not_enrolled');

  const existing = await db.progress.findFirst({
    where: { studentId: auth.userId, lessonId },
  });
  const data = {
    lastPositionSec,
    ...(completed ? { completedAt: new Date() } : {}),
  };
  const progress = existing
    ? await db.progress.update({ where: { id: existing.id }, data })
    : await db.progress.create({
        data: { tenantId: auth.tenantId!, studentId: auth.userId, lessonId, ...data },
      });
  return NextResponse.json({ progress });
}
