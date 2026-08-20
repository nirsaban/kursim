import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { requestLessonTranscription } from '@/lib/transcription/service';

type Params = { params: Promise<{ lessonId: string }> };

const bodySchema = z.object({ force: z.boolean().default(false) });

/** Queue (or force-redo) transcription for one lesson — the admin retry. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { lessonId } = await params;
  const parsed = await parseBody(req, bodySchema);
  if ('error' in parsed) return parsed.error;

  const outcome = await requestLessonTranscription(auth.tenantId!, lessonId, {
    force: parsed.data.force,
  });
  if (outcome === 'no_media') return apiError(404, 'lesson_video_not_found');
  if (outcome === 'disabled') return apiError(503, 'transcription_disabled');
  return NextResponse.json({ outcome });
}
