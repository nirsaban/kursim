import { getRedis } from '@/lib/redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/** Fixed-window rate limiter backed by Redis. */
export async function rateLimit(
  name: string,
  id: string,
  opts: { limit: number; windowSec: number },
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % opts.windowSec);
  const key = `ratelimit:${name}:${id}:${windowStart}`;
  const r = getRedis();
  const count = await r.incr(key);
  if (count === 1) {
    await r.expire(key, opts.windowSec + 1);
  }
  return {
    allowed: count <= opts.limit,
    remaining: Math.max(0, opts.limit - count),
    retryAfterSec: windowStart + opts.windowSec - now,
  };
}

export const LOGIN_LIMIT = { limit: 10, windowSec: 60 };
export const REFRESH_LIMIT = { limit: 30, windowSec: 60 };
export const INVITE_LIMIT = { limit: 20, windowSec: 3600 };
