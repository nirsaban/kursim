import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { publicIdBelongsToCourse } from '@/lib/cloudinary/sign-upload';
import { isCloudinaryConfigured } from '@/lib/cloudinary/client';
import { signedDeliveryUrl, DOC_URL_TTL_SEC } from '@/lib/cloudinary/sign-delivery';

type Params = { params: Promise<{ courseId: string }> };

const bodySchema = z.object({
  publicIds: z.array(z.string().min(1).max(512)).max(24),
});

/**
 * Short-lived signed image URLs so the owner panel can show thumbnails of
 * assets it has only publicIds for. Staff-only, and every id must sit inside
 * this course's folder — the same guard the marketing PUT applies.
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;
  const parsed = await parseBody(req, bodySchema);
  if ('error' in parsed) return parsed.error;

  const course = await forTenant(auth.tenantId!).course.findFirst({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) return apiError(404, 'not_found');
  if (!isCloudinaryConfigured()) return apiError(503, 'not_configured');

  const urls: Record<string, string> = {};
  for (const publicId of parsed.data.publicIds) {
    if (!publicIdBelongsToCourse(publicId, auth.tenantId!, courseId)) {
      return apiError(400, 'public_id_outside_tenant_folder');
    }
    urls[publicId] = signedDeliveryUrl(publicId, 'image', DOC_URL_TTL_SEC, 'jpg');
  }
  return NextResponse.json({ urls });
}
