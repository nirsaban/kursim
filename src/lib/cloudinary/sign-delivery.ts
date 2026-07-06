import { getCloudinary } from './client';

export const VIDEO_URL_TTL_SEC = 4 * 3600; // survives a viewing session
export const DOC_URL_TTL_SEC = 15 * 60;

/**
 * Signed, expiring delivery URL for an authenticated asset. Shared links die
 * on expiry, and a killed session can't mint new ones.
 */
export function signedDeliveryUrl(
  publicId: string,
  resourceType: 'video' | 'image' | 'raw',
  ttlSec: number,
  format?: string,
): string {
  const cld = getCloudinary();
  return cld.utils.private_download_url(publicId, format ?? '', {
    resource_type: resourceType,
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + ttlSec,
  });
}
