import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { broadcastSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { notifyMany } from '@/lib/notify';

/** Owner: list the 50 most recent broadcasts. */
export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;

  const broadcasts = await forTenant(auth.tenantId!).broadcast.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({ broadcasts });
}

/** Owner: send a broadcast to all active students, or just a course's students. */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, broadcastSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const { subject, body, courseId } = parsed.data;

  const students = await db.user.findMany({
    where: { role: 'STUDENT', status: 'ACTIVE' },
    select: { id: true },
  });
  let recipientIds = students.map((s) => s.id);

  if (courseId) {
    const enrollments = await db.enrollment.findMany({
      where: { courseId },
      select: { studentId: true },
    });
    const enrolled = new Set(enrollments.map((e) => e.studentId));
    recipientIds = recipientIds.filter((id) => enrolled.has(id));
  }

  await db.broadcast.create({
    data: {
      tenantId: auth.tenantId!,
      authorId: auth.userId,
      courseId: courseId ?? null,
      subject,
      body,
      sentCount: recipientIds.length,
    },
  });

  if (recipientIds.length > 0) {
    await notifyMany(db, auth.tenantId!, recipientIds, {
      type: 'broadcast',
      title: subject,
      body,
      link: `/t/${auth.tenantSlug}/notifications`,
    });
  }

  return NextResponse.json({ sent: recipientIds.length });
}
