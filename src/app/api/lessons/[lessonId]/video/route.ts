import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { attachMediaSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { publicIdBelongsToCourse } from '@/lib/cloudinary/sign-upload';
import { destroyPublicIds } from '@/lib/cloudinary/cleanup';
import { keyBelongsToCourse } from '@/lib/media-store/paths';
import { deleteMediaKeys } from '@/lib/media-store/store';

type Params = { params: Promise<{ lessonId: string }> };

/** Drops a video from whichever backend is holding it. Best-effort. */
function destroyVideo(publicId: string, provider: 'CLOUDINARY' | 'LOCAL'): void {
  if (provider === 'LOCAL') deleteMediaKeys([publicId]).catch(() => {});
  else destroyPublicIds([{ publicId, video: true }]).catch(() => {});
}

/** After a direct upload succeeds, the client reports the public_id here. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { lessonId } = await params;
  const parsed = await parseBody(req, attachMediaSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId },
    include: { module: true },
  });
  if (!lesson) return apiError(404, 'not_found');

  // Whichever backend it came from, the id must sit inside this tenant's folder
  // for this course — the two prefixes are identical by design.
  const courseId = lesson.module.courseId;
  const belongs =
    parsed.data.provider === 'LOCAL'
      ? keyBelongsToCourse(parsed.data.publicId, auth.tenantId!, courseId)
      : publicIdBelongsToCourse(parsed.data.publicId, auth.tenantId!, courseId);
  if (!belongs) return apiError(400, 'public_id_outside_tenant_folder');

  const previous = lesson.videoPublicId;
  const previousProvider = lesson.videoProvider;
  const updated = await db.lesson.update({
    where: { id: lesson.id },
    data: {
      videoPublicId: parsed.data.publicId,
      videoProvider: parsed.data.provider,
      durationSec: parsed.data.durationSec ?? null,
    },
  });
  if (previous && previous !== parsed.data.publicId) {
    destroyVideo(previous, previousProvider);
  }
  return NextResponse.json({ lesson: updated });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { lessonId } = await params;

  const db = forTenant(auth.tenantId!);
  const lesson = await db.lesson.findFirst({ where: { id: lessonId } });
  if (!lesson) return apiError(404, 'not_found');

  await db.lesson.update({
    where: { id: lesson.id },
    data: { videoPublicId: null, videoProvider: 'CLOUDINARY', durationSec: null },
  });
  if (lesson.videoPublicId) {
    destroyVideo(lesson.videoPublicId, lesson.videoProvider);
  }
  return NextResponse.json({ ok: true });
}
