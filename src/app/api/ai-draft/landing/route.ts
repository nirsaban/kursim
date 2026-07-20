import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { landingDraftRequestSchema } from '@/lib/validation/ai-builder';
import { aiConfig } from '@/lib/ai/gemini';
import { generateLandingDraft } from '@/lib/ai/copywriter';

/**
 * AI Builder: draft landing-page copy during course CREATION, before the
 * course exists in the DB — facts come straight from the request body
 * instead of a courseId lookup. See ../../courses/[courseId]/ai-draft for
 * the equivalent used once a course already exists. Not persisted.
 */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  if (!aiConfig().enabled) return apiError(503, 'ai_disabled');

  const parsed = await parseBody(req, landingDraftRequestSchema);
  if ('error' in parsed) return parsed.error;

  try {
    const draft = await generateLandingDraft({
      answers: parsed.data.answers,
      language: 'עברית',
      courseTitle: parsed.data.courseTitle,
      courseDescription: parsed.data.courseDescription,
      existingHeadline: parsed.data.existingHeadline,
      existingSubheadline: parsed.data.existingSubheadline,
      instructorName: parsed.data.instructorName,
    });
    return NextResponse.json({ draft });
  } catch (e) {
    return apiError(502, 'ai_generation_failed', { message: e instanceof Error ? e.message : String(e) });
  }
}
