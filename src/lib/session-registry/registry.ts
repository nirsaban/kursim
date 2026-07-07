import { randomBytes, randomUUID } from 'crypto';
import { getRedis } from '@/lib/redis';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

export const sessKey = (sid: string) => `sess:${sid}`;
export const userSessionsKey = (userId: string) => `user_sessions:${userId}`;
export const evictChannel = (sid: string) => `evict:${sid}`;
export const rotationKey = (sid: string) => `sess:${sid}:rotation`;
const rotationLockKey = (sid: string) => `sess:${sid}:rotation_lock`;

/**
 * How long a just-replaced refresh token may be replayed. Concurrent requests
 * (two tabs, heartbeat + navigation) legitimately present the same token;
 * within this window they get the same rotation result instead of being
 * treated as token theft.
 */
const ROTATION_GRACE_SEC = 60;

export interface SessionRecord {
  sid: string;
  userId: string;
  tenantId: string | null;
  deviceLabel: string;
  ua: string;
  ip: string;
  createdAt: number;
  lastSeenAt: number;
}

function sessionTtlSeconds(): number {
  return Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30) * 86400;
}

export async function createSession(input: {
  userId: string;
  tenantId: string | null;
  ua?: string;
  ip?: string;
  deviceLabel?: string;
}): Promise<{ sid: string; refreshToken: string }> {
  const sid = randomUUID();
  const refreshToken = randomBytes(32).toString('base64url');
  const refreshHash = await hashPassword(refreshToken);
  const now = Date.now();
  await getRedis()
    .multi()
    .hset(sessKey(sid), {
      userId: input.userId,
      tenantId: input.tenantId ?? '',
      deviceLabel: input.deviceLabel ?? '',
      ua: input.ua ?? '',
      ip: input.ip ?? '',
      createdAt: String(now),
      lastSeenAt: String(now),
      refreshHash,
    })
    .expire(sessKey(sid), sessionTtlSeconds())
    .zadd(userSessionsKey(input.userId), now, sid)
    .exec();
  return { sid, refreshToken };
}

export async function sessionExists(sid: string): Promise<boolean> {
  return (await getRedis().exists(sessKey(sid))) === 1;
}

export async function getSession(sid: string): Promise<SessionRecord | null> {
  const data = await getRedis().hgetall(sessKey(sid));
  if (!data || !data.userId) return null;
  return {
    sid,
    userId: data.userId,
    tenantId: data.tenantId || null,
    deviceLabel: data.deviceLabel ?? '',
    ua: data.ua ?? '',
    ip: data.ip ?? '',
    createdAt: Number(data.createdAt ?? 0),
    lastSeenAt: Number(data.lastSeenAt ?? 0),
  };
}

/** Updates lastSeenAt and slides the session TTL. Drives heartbeat + eviction order. */
export async function touchSession(sid: string, userId: string): Promise<void> {
  const now = Date.now();
  await getRedis()
    .multi()
    .hset(sessKey(sid), { lastSeenAt: String(now) })
    .expire(sessKey(sid), sessionTtlSeconds())
    .zadd(userSessionsKey(userId), now, sid)
    .exec();
}

export async function evictSession(sid: string, opts: { notify?: boolean } = {}): Promise<void> {
  const r = getRedis();
  const userId = await r.hget(sessKey(sid), 'userId');
  const multi = r.multi().del(sessKey(sid)).del(rotationKey(sid));
  if (userId) multi.zrem(userSessionsKey(userId), sid);
  await multi.exec();
  if (opts.notify !== false) {
    await r.publish(evictChannel(sid), 'evicted');
  }
}

/** Live sessions for a user, oldest activity first. Prunes dead sids from the index. */
export async function listLiveSessions(userId: string): Promise<SessionRecord[]> {
  const r = getRedis();
  const sids = await r.zrange(userSessionsKey(userId), 0, -1);
  const live: SessionRecord[] = [];
  for (const sid of sids) {
    const rec = await getSession(sid);
    if (rec) {
      live.push(rec);
    } else {
      await r.zrem(userSessionsKey(userId), sid);
    }
  }
  live.sort((a, b) => a.lastSeenAt - b.lastSeenAt);
  return live;
}

export async function countLiveSessions(userId: string): Promise<number> {
  return (await listLiveSessions(userId)).length;
}

export async function killAllSessions(userId: string): Promise<number> {
  const sessions = await listLiveSessions(userId);
  for (const s of sessions) {
    await evictSession(s.sid);
  }
  return sessions.length;
}

export type RotateResult =
  | { ok: true; refreshToken: string }
  | { ok: false; reason: 'invalid' | 'reused' };

/**
 * Rotate the refresh token. Serialized per session (Redis lock) so concurrent
 * refreshes can't double-rotate. A token replaced within the last
 * ROTATION_GRACE_SEC replays the same rotation result — that's a benign race
 * (two tabs, parallel requests), not theft. A presented token matching
 * neither the current hash nor the just-replaced one means it was rotated
 * long ago — assume theft and kill the session.
 */
export async function rotateRefreshToken(sid: string, presented: string): Promise<RotateResult> {
  const lock = await acquireRotationLock(sid);
  try {
    return await rotateRefreshTokenLocked(sid, presented);
  } finally {
    if (lock) await releaseRotationLock(sid, lock);
  }
}

async function rotateRefreshTokenLocked(sid: string, presented: string): Promise<RotateResult> {
  const r = getRedis();
  const stored = await r.hget(sessKey(sid), 'refreshHash');
  if (!stored) return { ok: false, reason: 'invalid' };

  if (await verifyPassword(stored, presented)) {
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshHash = await hashPassword(refreshToken);
    await r
      .multi()
      .hset(sessKey(sid), { refreshHash })
      .set(rotationKey(sid), JSON.stringify({ prevHash: stored, token: refreshToken }), 'EX', ROTATION_GRACE_SEC)
      .exec();
    return { ok: true, refreshToken };
  }

  // Not the current token — check whether it's the one replaced moments ago.
  const rotRaw = await r.get(rotationKey(sid));
  if (rotRaw) {
    try {
      const rot = JSON.parse(rotRaw) as { prevHash: string; token: string };
      if (await verifyPassword(rot.prevHash, presented)) {
        return { ok: true, refreshToken: rot.token };
      }
    } catch {
      // corrupt record — fall through to theft handling
    }
  }

  await evictSession(sid);
  return { ok: false, reason: 'reused' };
}

/** Best-effort per-session mutex; ~2s of retries, then proceeds unlocked. */
async function acquireRotationLock(sid: string): Promise<string | null> {
  const r = getRedis();
  const token = randomUUID();
  for (let attempt = 0; attempt < 40; attempt++) {
    const ok = await r.set(rotationLockKey(sid), token, 'EX', 5, 'NX');
    if (ok) return token;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

async function releaseRotationLock(sid: string, token: string): Promise<void> {
  const r = getRedis();
  if ((await r.get(rotationLockKey(sid))) === token) {
    await r.del(rotationLockKey(sid));
  }
}
