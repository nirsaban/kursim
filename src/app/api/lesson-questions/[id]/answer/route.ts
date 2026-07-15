import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { lessonAnswerSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { notify } from '@/lib/notify';

type Params = { params: Promise<{ id: string }> };

/** Staff answers a student's lesson question; the student is notified. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const parsed = await parseBody(req, lessonAnswerSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const question = await db.lessonQuestion.findFirst({ where: { id } });
  if (!question) return apiError(404, 'not_found');

  const updated = await db.lessonQuestion.update({
    where: { id },
    data: {
      answer: parsed.data.answer.trim(),
      answeredById: auth.userId,
      answeredAt: new Date(),
    },
  });

  try {
    await notify(db, auth.tenantId!, {
      userId: question.studentId,
      type: 'qa_answer',
      title: question.body.slice(0, 80),
      body: parsed.data.answer.trim().slice(0, 140),
      link: `/t/${auth.tenantSlug}/lesson/${question.lessonId}`,
    });
  } catch {
    // ignore notification failures
  }

  return NextResponse.json({ question: updated });
}
