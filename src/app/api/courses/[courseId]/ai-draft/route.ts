import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { aiBuilderAnswersSchema } from '@/lib/validation/ai-builder';
import { parseMarketing } from '@/lib/validation/marketing';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { aiConfig } from '@/lib/ai/gemini';
import { generateLandingDraft } from '@/lib/ai/copywriter';

type Params = { params: Promise<{ courseId: string }> };

/** AI Builder: draft landing-page copy from the wizard's answers. Not persisted. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  if (!aiConfig().enabled) return apiError(503, 'ai_disabled');
  const { courseId } = await params;

  const parsed = await parseBody(req, aiBuilderAnswersSchema);
  if ('error' in parsed) return parsed.error;

  const course = await forTenant(auth.tenantId!).course.findFirst({
    where: { id: courseId },
    select: { title: true, description: true, marketing: true },
  });
  if (!course) return apiError(404, 'not_found');
  const m = parseMarketing(course.marketing);

  try {
    const draft = await generateLandingDraft({
      answers: parsed.data,
      language: 'עברית',
      courseTitle: course.title,
      courseDescription: course.description ?? '',
      existingHeadline: m.headline,
      existingSubheadline: m.subheadline,
      instructorName: m.instructorName,
    });
    return NextResponse.json({ draft });
  } catch (e) {
    return apiError(502, 'ai_generation_failed', { message: e instanceof Error ? e.message : String(e) });
  }
}
