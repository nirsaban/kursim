import { evictSession, listActiveSessions, SessionRecord } from './registry';

export type EvictionPolicy = 'BLOCK' | 'EVICT_OLDEST';

export type PolicyResult =
  | { allowed: true; evicted: string[] }
  | { allowed: false; sessions: SessionRecord[] };

/**
 * Enforce the per-user screen limit before creating a new session.
 * BLOCK: refuse the new login, returning the open screens for display.
 * EVICT_OLDEST: evict the least-recently-active screen(s) to make room.
 *
 * The limit counts screens open *right now* (see `window.ts`), not logins ever
 * made. A session whose screen is closed holds no seat and is left untouched —
 * the student stays logged in on that device, they just stop occupying a seat
 * while they aren't watching.
 */
export async function enforceSessionPolicy(
  userId: string,
  limit: number,
  policy: EvictionPolicy,
): Promise<PolicyResult> {
  const open = await listActiveSessions(userId);
  if (open.length < limit) return { allowed: true, evicted: [] };

  if (policy === 'BLOCK') {
    return { allowed: false, sessions: open };
  }

  const overflow = open.length - limit + 1;
  const evicted: string[] = [];
  for (const s of open.slice(0, overflow)) {
    await evictSession(s.sid);
    evicted.push(s.sid);
  }
  return { allowed: true, evicted };
}
