import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { apiError } from '@/lib/api';
import { contentTypeForKey, resolveKey } from '@/lib/media-store/paths';
import { verifyMediaSignature } from '@/lib/media-store/sign';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ key: string[] }> };

/**
 * Caps how much a single response may carry. Browsers ask for `bytes=0-` and
 * then follow up with more ranges, so answering with a slice keeps every
 * response small — the proxy never has to buffer a multi-GB body, and playback
 * starts as soon as the first slice lands.
 */
const MAX_SLICE_BYTES = 8 * 1024 * 1024;

/**
 * Serves a locally stored lesson video. There is no session check here by
 * design: the URL itself is the capability, signed and expiring, minted only by
 * /api/lessons/[lessonId]/play after session + enrollment have been verified —
 * the same shape as a Cloudinary private URL.
 */
export async function GET(req: Request, { params }: Params) {
  const { key: segments } = await params;
  const key = segments.map((segment) => decodeURIComponent(segment)).join('/');

  const url = new URL(req.url);
  const exp = Number(url.searchParams.get('exp'));
  const sig = url.searchParams.get('sig') ?? '';
  if (!verifyMediaSignature(key, exp, sig)) return apiError(403, 'bad_signature');

  const abs = resolveKey(key);
  if (!abs) return apiError(400, 'bad_key');

  const stat = await fs.stat(abs).catch(() => null);
  if (!stat || !stat.isFile()) return apiError(404, 'not_found');

  const range = req.headers.get('range');
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  const headers = new Headers({
    'Content-Type': contentTypeForKey(key),
    'Accept-Ranges': 'bytes',
    // Signed and expiring: never let a shared cache hold on to it.
    'Cache-Control': 'private, no-store',
  });

  if (!match) {
    headers.set('Content-Length', String(stat.size));
    const stream = createReadStream(abs);
    return new Response(Readable.toWeb(stream) as ReadableStream, { status: 200, headers });
  }

  const start = match[1] ? Number(match[1]) : 0;
  const requestedEnd = match[2] ? Number(match[2]) : stat.size - 1;
  if (start >= stat.size || start < 0 || requestedEnd < start) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${stat.size}` },
    });
  }
  const end = Math.min(requestedEnd, stat.size - 1, start + MAX_SLICE_BYTES - 1);

  headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
  headers.set('Content-Length', String(end - start + 1));
  const stream = createReadStream(abs, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream, { status: 206, headers });
}
