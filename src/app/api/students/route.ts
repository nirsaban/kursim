import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { createStudentSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { hashPassword } from '@/lib/auth/password';
import { countLiveSessions } from '@/lib/session-registry/registry';

export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const db = forTenant(auth.tenantId!);
  const users = await db.user.findMany({
    where: { role: { in: ['STUDENT', 'INSTRUCTOR'] } },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const withSessions = await Promise.all(
    users.map(async (u) => ({ ...u, liveSessions: await countLiveSessions(u.id) })),
  );
  return NextResponse.json({ students: withSessions });
}

export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, createStudentSchema);
  if ('error' in parsed) return parsed.error;
  const { email, password, role, courseIds } = parsed.data;

  const db = forTenant(auth.tenantId!);
  const existing = await db.user.findFirst({ where: { email: email.toLowerCase() } });
  if (existing) return apiError(409, 'email_taken');

  const user = await db.user.create({
    data: {
      tenantId: auth.tenantId!,
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      role,
      status: 'ACTIVE',
      mustChangePassword: true,
    },
  });

  if (role === 'STUDENT' && courseIds?.length) {
    for (const courseId of courseIds) {
      const course = await db.course.findFirst({ where: { id: courseId } });
      if (course) {
        await db.enrollment.create({
          data: { tenantId: auth.tenantId!, studentId: user.id, courseId },
        });
      }
    }
  }

  return NextResponse.json(
    { student: { id: user.id, email: user.email, role: user.role, status: user.status } },
    { status: 201 },
  );
}
