import { NextResponse } from 'next/server';
import { requireAuth, forbidden } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { reviewSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

type Params = { params: Promise<{ courseId: string }> };

/** Owner/instructor: all reviews for moderation. */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;

  const reviews = await forTenant(auth.tenantId!).courseReview.findMany({
    where: { courseId },
    orderBy: { createdAt: 'desc' },
    include: { student: { select: { email: true } } },
  });
  return NextResponse.json({ reviews });
}

/**
 * Student submits one review per course, unlocked when every lesson in the
 * course is completed ("collected at the end of the course").
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['STUDENT'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;
  const parsed = await parseBody(req, reviewSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const course = await db.course.findFirst({
    where: { id: courseId },
    include: { modules: { include: { lessons: { select: { id: true } } } } },
  });
  if (!course) return apiError(404, 'not_found');

  const enrolled = await db.enrollment.findFirst({
    where: { studentId: auth.userId, courseId },
  });
  if (!enrolled) return forbidden('not_enrolled');

  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  if (lessonIds.length > 0) {
    const completed = await db.progress.count({
      where: {
        studentId: auth.userId,
        lessonId: { in: lessonIds },
        completedAt: { not: null },
      },
    });
    if (completed < lessonIds.length) return forbidden('course_not_completed');
  }

  const existing = await db.courseReview.findFirst({
    where: { courseId, studentId: auth.userId },
  });
  if (existing) return apiError(409, 'already_reviewed');

  const review = await db.courseReview.create({
    data: {
      tenantId: auth.tenantId!,
      courseId,
      studentId: auth.userId,
      name: parsed.data.name.trim(),
      rating: parsed.data.rating,
      text: parsed.data.text.trim(),
      privateNote: parsed.data.privateNote.trim(),
    },
  });
  return NextResponse.json({ review }, { status: 201 });
}
