import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { isCloudinaryConfigured } from '@/lib/cloudinary/client';
import { aiConfig } from '@/lib/ai/gemini';
import { courseToMediaInputs } from '@/lib/ai/inputs';
import { enqueueCourseMedia } from '@/lib/ai/queue';

type Params = { params: Promise<{ courseId: string }> };

/** Kick off AI marketing-media generation for a course (Gemini → Veo + Imagen). */
export async function POST(_req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;

  if (!aiConfig().enabled) return apiError(503, 'ai_disabled');
  // Veo billing caused unexpected cost from pipeline retries — disabled
  // independently of AI_MEDIA_ENABLED until deliberately re-enabled.
  if (!aiConfig().videoEnabled) return apiError(503, 'ai_video_disabled');
  if (!isCloudinaryConfigured()) return apiError(400, 'cloudinary_missing');

  const db = forTenant(auth.tenantId!);
  const course = await db.course.findFirst({ where: { id: courseId } });
  if (!course) return apiError(404, 'not_found');

  const existing = await db.courseMedia.findFirst({ where: { courseId } });
  if (existing?.status === 'generating') return apiError(409, 'already_generating');

  await db.courseMedia.upsert({
    where: { courseId },
    // tenantId is also injected by the scoped client; included here for the type checker.
    create: { courseId, tenantId: auth.tenantId!, status: 'generating' },
    update: { status: 'generating', error: null },
  });

  await enqueueCourseMedia({
    tenantId: auth.tenantId!,
    courseId,
    inputs: courseToMediaInputs(course),
  });

  return NextResponse.json({ status: 'generating' }, { status: 202 });
}
