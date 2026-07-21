import { NextResponse } from 'next/server';
import { requireAuth, forbidden } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { lessonQuestionSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { notify } from '@/lib/notify';
import { he } from '@/lib/he';

/** List questions for one lesson (?lessonId=). Any authenticated tenant user. */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const lessonId = new URL(req.url).searchParams.get('lessonId');
  if (!lessonId) return apiError(400, 'lessonId required');

  const questions = await forTenant(auth.tenantId!).lessonQuestion.findMany({
    where: { lessonId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ questions });
}

/** A student asks a question on a lesson; staff get notified. */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['STUDENT'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, lessonQuestionSchema);
  if ('error' in parsed) return parsed.error;
  const { lessonId, body } = parsed.data;

  const db = forTenant(auth.tenantId!);
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson) return apiError(404, 'not_found');

  const enrolled = await db.enrollment.findFirst({
    where: { studentId: auth.userId, courseId: lesson.module.courseId },
  });
  if (!enrolled) return forbidden('not_enrolled');

  const me = await db.user.findFirst({ where: { id: auth.userId }, select: { name: true } });
  // studentName is persisted once and shown to instructors and other students in
  // lesson Q&A — never derive it from email; anonymize when no display name is set.
  const studentName = me?.name?.trim() || he.anonymousLearner;

  const question = await db.lessonQuestion.create({
    data: {
      tenantId: auth.tenantId!,
      lessonId,
      courseId: lesson.module.courseId,
      studentId: auth.userId,
      studentName,
      body: body.trim(),
    },
  });

  // Notify the tenant's staff (owners + instructors) that a new question arrived.
  try {
    const staff = await db.user.findMany({
      where: { role: { in: ['OWNER', 'INSTRUCTOR'] }, status: 'ACTIVE' },
      select: { id: true },
    });
    await Promise.all(
      staff.map((s) =>
        notify(db, auth.tenantId!, {
          userId: s.id,
          type: 'qa_question',
          title: studentName,
          body: body.trim().slice(0, 140),
          link: `/t/${auth.tenantSlug}/lesson/${lessonId}`,
        }),
      ),
    );
  } catch {
    // never fail the question on a notification hiccup
  }

  return NextResponse.json({ question }, { status: 201 });
}
