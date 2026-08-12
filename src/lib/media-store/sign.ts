import { createHmac, timingSafeEqual } from 'node:crypto';

/** Matches the Cloudinary video TTL: long enough to watch, short enough to rot. */
export const MEDIA_URL_TTL_SEC = 4 * 3600;

/**
 * Locally stored media is served by a route that trusts nothing but this
 * signature — the same contract as a Cloudinary private URL. The key is
 * derived from AUTH_SECRET so there is no extra secret to configure, and
 * domain-separated so a media URL can never be replayed as an auth token.
 */
function signingKey(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is required to sign media URLs');
  return createHmac('sha256', secret).update('kursim:media-url:v1').digest('hex');
}

function digest(key: string, exp: number): string {
  return createHmac('sha256', signingKey()).update(`${key}\n${exp}`).digest('hex');
}

/** Signed, expiring URL for a stored key. */
export function signedMediaUrl(key: string, ttlSec: number = MEDIA_URL_TTL_SEC): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const path = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `/api/media/local/file/${path}?exp=${exp}&sig=${digest(key, exp)}`;
}

export function verifyMediaSignature(key: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(digest(key, exp), 'utf8');
  const given = Buffer.from(sig, 'utf8');
  return expected.length === given.length && timingSafeEqual(expected, given);
}
