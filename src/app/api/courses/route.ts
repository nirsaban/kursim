import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
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

  const db = forTenant(auth.tenantId!);

  // Catalog numbers are unique per tenant. An explicit one must be free;
  // otherwise take max+1. Two owners creating a course at the same instant can
  // pick the same number, so retry on the unique-constraint bounce rather than
  // locking the table.
  const explicit = parsed.data.catalogNumber;
  if (explicit !== undefined) {
    const clash = await db.course.findFirst({ where: { catalogNumber: explicit } });
    if (clash) return apiError(409, 'catalog_number_taken');
  }

  for (let attempt = 0; ; attempt++) {
    const catalogNumber =
      explicit ??
      ((await db.course.aggregate({ _max: { catalogNumber: true } }))._max.catalogNumber ?? 0) + 1;
    try {
      const course = await db.course.create({
        data: {
          tenantId: auth.tenantId!,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          status: parsed.data.status ?? 'DRAFT',
          catalogNumber,
        },
      });
      return NextResponse.json({ course }, { status: 201 });
    } catch (err) {
      const taken =
        typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
      if (!taken || explicit !== undefined) return apiError(409, 'catalog_number_taken');
      if (attempt >= 4) return apiError(409, 'catalog_number_taken');
      // else: someone took our number between the read and the write — recompute.
    }
  }
}
