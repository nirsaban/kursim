import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { localUploadIdSchema } from '@/lib/validation/schemas';
import { completeUpload, readUploadMeta } from '@/lib/media-store/store';

export const runtime = 'nodejs';

/** Assembles the parts into the final file once they've all been sent. */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, localUploadIdSchema);
  if ('error' in parsed) return parsed.error;

  const meta = await readUploadMeta(parsed.data.uploadId);
  if (!meta || meta.tenantId !== auth.tenantId) return apiError(404, 'not_found');

  // Returns null on a missing part or a size mismatch, so a truncated upload
  // can never be attached to a lesson.
  const key = await completeUpload(parsed.data.uploadId);
  if (!key) return apiError(400, 'incomplete_upload');
  return NextResponse.json({ key });
}
