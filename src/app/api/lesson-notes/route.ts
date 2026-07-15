import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { lessonNoteSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

/** The current student's private note for a lesson (?lessonId=). */
export async function GET(req: Request) {
  const auth = await requireAuth({ roles: ['STUDENT'] });
  if (auth instanceof NextResponse) return auth;
  const lessonId = new URL(req.url).searchParams.get('lessonId');
  if (!lessonId) return NextResponse.json({ note: null });

  const note = await forTenant(auth.tenantId!).lessonNote.findFirst({
    where: { studentId: auth.userId, lessonId },
  });
  return NextResponse.json({ note });
}

/** Save (upsert) the student's private note for a lesson. */
export async function PUT(req: Request) {
  const auth = await requireAuth({ roles: ['STUDENT'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, lessonNoteSchema);
  if ('error' in parsed) return parsed.error;
  const { lessonId, courseId, body } = parsed.data;

  const db = forTenant(auth.tenantId!);
  const note = await db.lessonNote.upsert({
    where: { studentId_lessonId: { studentId: auth.userId, lessonId } },
    create: { tenantId: auth.tenantId!, studentId: auth.userId, lessonId, courseId, body },
    update: { body },
  });
  return NextResponse.json({ note });
}
