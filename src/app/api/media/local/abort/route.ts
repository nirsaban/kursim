import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { localUploadIdSchema } from '@/lib/validation/schemas';
import { abortUpload, readUploadMeta } from '@/lib/media-store/store';

export const runtime = 'nodejs';

/** Discards a half-finished upload so its parts stop occupying the disk. */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseBody(req, localUploadIdSchema);
  if ('error' in parsed) return parsed.error;

  const meta = await readUploadMeta(parsed.data.uploadId);
  if (!meta || meta.tenantId !== auth.tenantId) return apiError(404, 'not_found');

  await abortUpload(parsed.data.uploadId);
  return NextResponse.json({ ok: true });
}
