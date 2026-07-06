import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { z } from 'zod';

type Params = { params: Promise<{ courseId: string }> };

const bodySchema = z.object({ studentId: z.string().uuid() });

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;
  const db = forTenant(auth.tenantId!);
  const enrollments = await db.enrollment.findMany({
    where: { courseId },
    include: { student: { select: { id: true, email: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ enrollments });
}

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;
  const parsed = await parseBody(req, bodySchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const [course, student] = await Promise.all([
    db.course.findFirst({ where: { id: courseId } }),
    db.user.findFirst({ where: { id: parsed.data.studentId, role: 'STUDENT' } }),
  ]);
  if (!course || !student) return apiError(404, 'not_found');

  const existing = await db.enrollment.findFirst({
    where: { courseId, studentId: student.id },
  });
  if (existing) return NextResponse.json({ enrollment: existing });

  const enrollment = await db.enrollment.create({
    data: { tenantId: auth.tenantId!, courseId, studentId: student.id },
  });
  return NextResponse.json({ enrollment }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;
  const parsed = await parseBody(req, bodySchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  await db.enrollment.deleteMany({
    where: { courseId, studentId: parsed.data.studentId },
  });
  return NextResponse.json({ ok: true });
}
