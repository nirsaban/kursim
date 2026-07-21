import { NextResponse } from 'next/server';
import { requireAuth, forbidden } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { progressSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { dayKey } from '@/lib/achievements';
import { notify } from '@/lib/notify';
import { he } from '@/lib/he';

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

  // Mark today (Asia/Jerusalem) as an active learning day — powers streaks.
  // Never let this write fail the progress save (e.g. concurrent-heartbeat race).
  try {
    const date = new Date(`${dayKey(new Date())}T00:00:00.000Z`);
    await db.learningActivity.upsert({
      where: { studentId_date: { studentId: auth.userId, date } },
      create: { tenantId: auth.tenantId!, studentId: auth.userId, date },
      update: {},
    });
  } catch {
    // ignore
  }

  // Course completion → issue a certificate once and notify the student.
  // Never let this block the progress save.
  if (completed) {
    try {
      const courseId = lesson.module.courseId;
      const courseLessons = await db.lesson.findMany({
        where: { module: { courseId } },
        select: { id: true },
      });
      const lessonIds = courseLessons.map((l) => l.id);
      if (lessonIds.length > 0) {
        const done = await db.progress.count({
          where: {
            studentId: auth.userId,
            lessonId: { in: lessonIds },
            completedAt: { not: null },
          },
        });
        if (done >= lessonIds.length) {
          const existingCert = await db.certificate.findFirst({
            where: { courseId, studentId: auth.userId },
          });
          if (!existingCert) {
            const [student, course] = await Promise.all([
              db.user.findFirst({ where: { id: auth.userId }, select: { email: true, name: true } }),
              db.course.findFirst({ where: { id: courseId }, select: { title: true } }),
            ]);
            const serial = `KURS-${courseId.slice(0, 4).toUpperCase()}-${Date.now()
              .toString(36)
              .toUpperCase()}`;
            await db.certificate.create({
              data: {
                tenantId: auth.tenantId!,
                courseId,
                studentId: auth.userId,
                studentName: student?.name?.trim() || (student?.email ?? '').split('@')[0],
                courseTitle: course?.title ?? '',
                serial,
              },
            });
            await notify(db, auth.tenantId!, {
              userId: auth.userId,
              type: 'certificate',
              title: he.certificateReady,
              body: course?.title ?? '',
              link: `/t/${auth.tenantSlug}/certificate/${courseId}`,
            });
          }
        }
      }
    } catch {
      // certificate/notification is best-effort; ignore races and errors
    }
  }

  return NextResponse.json({ progress });
}
