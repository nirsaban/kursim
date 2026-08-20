import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { syncCourseTranscriptions } from '@/lib/transcription/service';
import { transcriptionConfig } from '@/lib/transcription/gemini-stt';

type Params = { params: Promise<{ courseId: string }> };

const syncSchema = z.object({
  /** Also redo lessons/files that already have text (default: only missing/failed). */
  force: z.boolean().default(false),
});

/** The admin "sync transcriptions" button: queue everything that needs text. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;
  const parsed = await parseBody(req, syncSchema);
  if ('error' in parsed) return parsed.error;
  if (!transcriptionConfig().enabled) return apiError(503, 'transcription_disabled');

  const course = await forTenant(auth.tenantId!).course.findFirst({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) return apiError(404, 'not_found');

  const counts = await syncCourseTranscriptions(auth.tenantId!, courseId, {
    force: parsed.data.force,
  });
  return NextResponse.json(counts);
}

/** Per-lesson/attachment transcription state, for the admin content screen. */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;

  const db = forTenant(auth.tenantId!);
  const course = await db.course.findFirst({ where: { id: courseId }, select: { id: true } });
  if (!course) return apiError(404, 'not_found');

  const modules = await db.module.findMany({
    where: { courseId },
    orderBy: { sortOrder: 'asc' },
    select: {
      lessons: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          title: true,
          videoPublicId: true,
          transcriptStatus: true,
          transcriptError: true,
          transcribedAt: true,
          attachments: {
            select: { id: true, filename: true, kind: true, textStatus: true, textError: true },
          },
          knowledgeVersions: {
            where: { status: 'ACTIVE' },
            select: { id: true, error: true, activatedAt: true, _count: { select: { chunks: true } } },
          },
        },
      },
    },
  });
  const lessons = modules.flatMap((m) =>
    m.lessons.map((l) => {
      const active = l.knowledgeVersions[0];
      return {
        id: l.id,
        title: l.title,
        hasVideo: Boolean(l.videoPublicId),
        status: l.transcriptStatus,
        error: l.transcriptError,
        transcribedAt: l.transcribedAt,
        knowledgeStatus: active ? 'ACTIVE' : 'NONE',
        chunkCount: active?._count.chunks ?? 0,
        attachments: l.attachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          kind: a.kind,
          status: a.textStatus,
          error: a.textError,
        })),
      };
    }),
  );
  return NextResponse.json({ lessons });
}
