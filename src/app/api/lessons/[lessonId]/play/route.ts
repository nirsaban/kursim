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

  if (!isCloudinaryConfigured()) {
    return NextResponse.json({ videoUrl: null, attachments: [], configured: false });
  }

  return NextResponse.json({
    configured: true,
    videoUrl: lesson.videoPublicId
      ? signedDeliveryUrl(lesson.videoPublicId, 'video', VIDEO_URL_TTL_SEC, 'mp4')
      : null,
    attachments: lesson.attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      kind: a.kind,
      url: signedDeliveryUrl(a.publicId, a.kind === 'IMAGE' ? 'image' : 'raw', DOC_URL_TTL_SEC),
    })),
  });
}
