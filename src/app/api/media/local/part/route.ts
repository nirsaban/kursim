import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError } from '@/lib/api';
import { readUploadMeta, writePart } from '@/lib/media-store/store';

export const runtime = 'nodejs';

/**
 * Receives one chunk of an open upload and streams it to disk. The body is raw
 * bytes rather than JSON, so the part is written as it arrives instead of being
 * buffered whole. Parts are sized to stay under the proxy's body limit.
 */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const uploadId = url.searchParams.get('uploadId') ?? '';
  const partNumber = Number(url.searchParams.get('part'));

  const meta = await readUploadMeta(uploadId);
  if (!meta) return apiError(404, 'not_found');
  // The upload was opened by this tenant; nobody else may write into it.
  if (meta.tenantId !== auth.tenantId) return apiError(404, 'not_found');
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > meta.parts) {
    return apiError(400, 'bad_part_number');
  }
  if (!req.body) return apiError(400, 'empty_body');

  try {
    await writePart(uploadId, partNumber, req.body);
  } catch {
    return apiError(500, 'part_write_failed');
  }
  return NextResponse.json({ ok: true, part: partNumber });
}
