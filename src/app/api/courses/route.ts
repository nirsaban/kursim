import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { courseSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const db = forTenant(auth.tenantId!);

  if (auth.role === 'STUDENT') {
    const enrollments = await db.enrollment.findMany({
      where: { studentId: auth.userId },
      include: { course: { include: { modules: { include: { lessons: { select: { id: true } } } } } } },
    });
    const courses = enrollments
      .map((e) => e.course)
      .filter((c) => c.status === 'PUBLISHED')
      .map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        coverPublicId: c.coverPublicId,
        lessonCount: c.modules.reduce((n, m) => n + m.lessons.length, 0),
      }));
    return NextResponse.json({ courses });
  }

  const courses = await db.course.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { modules: true, enrollments: true } } },
  });
  return NextResponse.json({ courses });
}

export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, courseSchema);
  if ('error' in parsed) return parsed.error;

  const course = await forTenant(auth.tenantId!).course.create({
    data: {
      tenantId: auth.tenantId!,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status ?? 'DRAFT',
    },
  });
  return NextResponse.json({ course }, { status: 201 });
}
