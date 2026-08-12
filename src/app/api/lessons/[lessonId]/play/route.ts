import { NextResponse } from 'next/server';
import { requireAuth, forbidden } from '@/lib/auth/guards';
import { apiError } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { isCloudinaryConfigured } from '@/lib/cloudinary/client';
import {
  signedDeliveryUrl,
  VIDEO_URL_TTL_SEC,
  DOC_URL_TTL_SEC,
} from '@/lib/cloudinary/sign-delivery';
import { signedMediaUrl } from '@/lib/media-store/sign';

type Params = { params: Promise<{ lessonId: string }> };

/**
 * Mints signed, expiring media URLs for a lesson. Requires a live session
 * (guards) + enrollment — so a kicked device can't get new URLs, and shared
 * links die when the signature expires.
 */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { lessonId } = await params;

  const db = forTenant(auth.tenantId!);
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId },
    include: { module: { include: { course: true } }, attachments: true },
  });
  if (!lesson) return apiError(404, 'not_found');

  if (auth.role === 'STUDENT') {
    if (lesson.module.course.status !== 'PUBLISHED') return apiError(404, 'not_found');
    const enrolled = await db.enrollment.findFirst({
      where: { studentId: auth.userId, courseId: lesson.module.courseId },
    });
    if (!enrolled) return forbidden('not_enrolled');
  }

  const cloudinaryOn = isCloudinaryConfigured();
  if (!cloudinaryOn && !lesson.videoPublicId) {
    return NextResponse.json({ videoUrl: null, attachments: [], configured: false });
  }

  // The video is signed by whichever backend holds it; attachments are always
  // Cloudinary. Both URLs expire, so a shared link outlives nothing.
  let videoUrl: string | null = null;
  if (lesson.videoPublicId) {
    if (lesson.videoProvider === 'LOCAL') {
      videoUrl = signedMediaUrl(lesson.videoPublicId, VIDEO_URL_TTL_SEC);
    } else {
      videoUrl = cloudinaryOn
        ? signedDeliveryUrl(lesson.videoPublicId, 'video', VIDEO_URL_TTL_SEC, 'mp4')
        : null;
    }
  }

  return NextResponse.json({
    configured: true,
    videoUrl,
    attachments: cloudinaryOn
      ? lesson.attachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          kind: a.kind,
          url: signedDeliveryUrl(a.publicId, a.kind === 'IMAGE' ? 'image' : 'raw', DOC_URL_TTL_SEC),
        }))
      : [],
  });
}
