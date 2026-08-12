import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { signUploadSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { isCloudinaryConfigured } from '@/lib/cloudinary/client';
import { signUpload } from '@/lib/cloudinary/sign-upload';
import { isMediaStoreWritable } from '@/lib/media-store/store';

/**
 * Signs a direct browser→Cloudinary upload. The signature pins the tenant's
 * course folder and `type: authenticated`, so multi-GB videos never pass
 * through this server and can't land outside the tenant prefix.
 */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  if (!isCloudinaryConfigured()) return apiError(503, 'cloudinary_not_configured');

  const parsed = await parseBody(req, signUploadSchema);
  if ('error' in parsed) return parsed.error;

  const course = await forTenant(auth.tenantId!).course.findFirst({
    where: { id: parsed.data.courseId },
  });
  if (!course) return apiError(404, 'not_found');

  const signature = await signUpload(auth.tenantId!, course.id, parsed.data.kind);
  // Tells the uploader whether a file over Cloudinary's cap has somewhere else
  // to go, so it can route by size instead of just refusing.
  const fallback =
    parsed.data.kind === 'video' && (await isMediaStoreWritable()) ? 'local' : null;
  return NextResponse.json({ ...signature, fallback });
}
