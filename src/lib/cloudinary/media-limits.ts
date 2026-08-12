import { getRedis } from '@/lib/redis';
import { getCloudinary } from './client';

export type MediaKind = 'video' | 'image' | 'raw';

/**
 * Cloudinary caps the size of an uploaded asset per plan (Free: 100MB video,
 * 10MB image/raw) and rejects anything bigger with a 413 — from Cloudinary
 * itself, only after the browser has finished pushing every byte. We read the
 * live caps so the uploader can refuse a file up front, and so the numbers
 * follow the account by themselves if the plan is ever upgraded.
 */
export const FALLBACK_MEDIA_LIMITS: Record<MediaKind, number> = {
  video: 100 * 1024 * 1024,
  image: 10 * 1024 * 1024,
  raw: 10 * 1024 * 1024,
};

const CACHE_KEY = 'cloudinary:media-limits';
const CACHE_TTL_SEC = 3600;

interface UsageMediaLimits {
  video_max_size_bytes?: unknown;
  image_max_size_bytes?: unknown;
  raw_max_size_bytes?: unknown;
}

/** Keep only sane positive numbers — a missing or garbage field falls back. */
export function parseMediaLimits(raw: unknown): Record<MediaKind, number> {
  const limits = (raw ?? {}) as UsageMediaLimits;
  const pick = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  return {
    video: pick(limits.video_max_size_bytes, FALLBACK_MEDIA_LIMITS.video),
    image: pick(limits.image_max_size_bytes, FALLBACK_MEDIA_LIMITS.image),
    raw: pick(limits.raw_max_size_bytes, FALLBACK_MEDIA_LIMITS.raw),
  };
}

/**
 * The account's max upload size per asset kind, cached in Redis for an hour
 * (the Admin API is rate-limited, and these change about once a plan).
 *
 * Never throws: a Cloudinary or Redis hiccup degrades to the Free-plan numbers,
 * which are the smallest ones — so we may reject a file the plan would have
 * accepted, but we never wave through one it is going to 413 on.
 */
export async function mediaLimits(): Promise<Record<MediaKind, number>> {
  const redis = getRedis();
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return parseMediaLimits(JSON.parse(cached));
  } catch {
    // cache miss or unreachable Redis — fall through to a live lookup
  }

  try {
    const usage = (await getCloudinary().api.usage()) as { media_limits?: unknown };
    const limits = parseMediaLimits(usage.media_limits);
    try {
      await redis.set(CACHE_KEY, JSON.stringify(usage.media_limits ?? {}), 'EX', CACHE_TTL_SEC);
    } catch {
      // caching is best-effort
    }
    return limits;
  } catch {
    return FALLBACK_MEDIA_LIMITS;
  }
}

export async function mediaLimit(kind: MediaKind): Promise<number> {
  return (await mediaLimits())[kind];
}
