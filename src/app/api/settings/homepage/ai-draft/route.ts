import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { aiBuilderAnswersSchema } from '@/lib/validation/ai-builder';
import { parseHomepage } from '@/lib/validation/homepage';
import { prisma } from '@/lib/tenant/prisma';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { aiConfig } from '@/lib/ai/gemini';
import { generateHomepageDraft } from '@/lib/ai/copywriter';

/** AI Builder: draft home-page welcome copy from the wizard's answers. Not persisted. */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  if (!aiConfig().enabled) return apiError(503, 'ai_disabled');

  const parsed = await parseBody(req, aiBuilderAnswersSchema);
  if ('error' in parsed) return parsed.error;

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId! },
    select: { name: true, homepage: true },
  });
  if (!tenant) return apiError(404, 'not_found');
  const hp = parseHomepage(tenant.homepage);

  const courses = await forTenant(auth.tenantId!).course.findMany({
    where: { status: 'PUBLISHED' },
    select: { title: true },
    take: 10,
  });

  try {
    const draft = await generateHomepageDraft({
      answers: parsed.data,
      language: 'עברית',
      tenantName: tenant.name,
      existingAboutSchool: hp.aboutSchool,
      courseTitles: courses.map((c) => c.title),
    });
    return NextResponse.json({ draft });
  } catch (e) {
    return apiError(502, 'ai_generation_failed', { message: e instanceof Error ? e.message : String(e) });
  }
}
