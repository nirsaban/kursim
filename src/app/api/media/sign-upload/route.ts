import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { signUploadSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { isCloudinaryConfigured } from '@/lib/cloudinary/client';
import { signUpload } from '@/lib/cloudinary/sign-upload';

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

  return NextResponse.json(signUpload(auth.tenantId!, course.id, parsed.data.kind));
}
