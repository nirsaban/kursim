import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { attachMediaSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { publicIdBelongsToCourse } from '@/lib/cloudinary/sign-upload';
import { destroyPublicIds } from '@/lib/cloudinary/cleanup';

type Params = { params: Promise<{ lessonId: string }> };

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

  // The public_id must sit inside this tenant's folder for this course.
  if (!publicIdBelongsToCourse(parsed.data.publicId, auth.tenantId!, lesson.module.courseId)) {
    return apiError(400, 'public_id_outside_tenant_folder');
  }

  const previous = lesson.videoPublicId;
  const updated = await db.lesson.update({
    where: { id: lesson.id },
    data: {
      videoPublicId: parsed.data.publicId,
      durationSec: parsed.data.durationSec ?? null,
    },
  });
  if (previous && previous !== parsed.data.publicId) {
    destroyPublicIds([{ publicId: previous, video: true }]).catch(() => {});
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
    data: { videoPublicId: null, durationSec: null },
  });
  if (lesson.videoPublicId) {
    destroyPublicIds([{ publicId: lesson.videoPublicId, video: true }]).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
