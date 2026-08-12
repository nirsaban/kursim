import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { localCreateSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { maxUploadBytes } from '@/lib/media-store/paths';
import { createUpload, isMediaStoreWritable } from '@/lib/media-store/store';

export const runtime = 'nodejs';

/**
 * Opens a chunked upload for a video Cloudinary is too small to take. The key
 * is minted server-side inside the tenant's course folder — the client never
 * chooses where its bytes land.
 */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  if (!(await isMediaStoreWritable())) return apiError(503, 'media_store_unavailable');

  const parsed = await parseBody(req, localCreateSchema);
  if ('error' in parsed) return parsed.error;
  // Only enforced when MEDIA_MAX_UPLOAD_BYTES is set; unlimited otherwise.
  if (parsed.data.bytes > maxUploadBytes()) return apiError(413, 'file_too_large');

  const course = await forTenant(auth.tenantId!).course.findFirst({
    where: { id: parsed.data.courseId },
  });
  if (!course) return apiError(404, 'not_found');

  const upload = await createUpload(
    auth.tenantId!,
    course.id,
    parsed.data.filename,
    parsed.data.bytes,
  );
  return NextResponse.json(upload);
}
