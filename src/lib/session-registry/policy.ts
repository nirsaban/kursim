import { evictSession, listLiveSessions, SessionRecord } from './registry';

export type EvictionPolicy = 'BLOCK' | 'EVICT_OLDEST';

export type PolicyResult =
  | { allowed: true; evicted: string[] }
  | { allowed: false; sessions: SessionRecord[] };

/**
 * Enforce the per-user device/session limit before creating a new session.
 * BLOCK: refuse the new login, returning the active sessions for display.
 * EVICT_OLDEST: evict the least-recently-active session(s) to make room.
 */
export async function enforceSessionPolicy(
  userId: string,
  limit: number,
  policy: EvictionPolicy,
): Promise<PolicyResult> {
  const live = await listLiveSessions(userId);
  if (live.length < limit) return { allowed: true, evicted: [] };

  if (policy === 'BLOCK') {
    return { allowed: false, sessions: live };
  }

  const overflow = live.length - limit + 1;
  const evicted: string[] = [];
  for (const s of live.slice(0, overflow)) {
    await evictSession(s.sid);
    evicted.push(s.sid);
  }
  return { allowed: true, evicted };
}
