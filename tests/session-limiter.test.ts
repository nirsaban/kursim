import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/redis', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const client = new RedisMock();
  return {
    getRedis: () => client,
    createSubscriber: () => client.duplicate(),
  };
});

import { getRedis } from '@/lib/redis';
import {
  createSession,
  sessionExists,
  getSession,
  touchSession,
  evictSession,
  listLiveSessions,
  countLiveSessions,
  listActiveSessions,
  countActiveSessions,
  killAllSessions,
  rotateRefreshToken,
} from '@/lib/session-registry/registry';
import { enforceSessionPolicy } from '@/lib/session-registry/policy';
import { SCREEN_ACTIVE_WINDOW_MS } from '@/lib/session-registry/window';

const USER = 'user-1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Backdate a session's last ping: the screen behind it was closed. */
async function closeScreen(sid: string, agoMs = SCREEN_ACTIVE_WINDOW_MS + 60_000) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (getRedis() as any).hset(`sess:${sid}`, 'lastSeenAt', String(Date.now() - agoMs));
}

beforeEach(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (getRedis() as any).flushall();
});

describe('session registry', () => {
  it('creates and finds sessions', async () => {
    const { sid, refreshToken } = await createSession({ userId: USER, tenantId: 't1', ua: 'UA' });
    expect(refreshToken.length).toBeGreaterThan(30);
    expect(await sessionExists(sid)).toBe(true);
    const rec = await getSession(sid);
    expect(rec?.userId).toBe(USER);
    expect(rec?.tenantId).toBe('t1');
    expect(await countLiveSessions(USER)).toBe(1);
  });

  it('evicts a session and prunes the index', async () => {
    const { sid } = await createSession({ userId: USER, tenantId: 't1' });
    await evictSession(sid);
    expect(await sessionExists(sid)).toBe(false);
    expect(await countLiveSessions(USER)).toBe(0);
  });

  it('kills all sessions for a user', async () => {
    await createSession({ userId: USER, tenantId: 't1' });
    await createSession({ userId: USER, tenantId: 't1' });
    await createSession({ userId: USER, tenantId: 't1' });
    expect(await killAllSessions(USER)).toBe(3);
    expect(await countLiveSessions(USER)).toBe(0);
  });

  it('orders sessions by last activity, oldest first', async () => {
    const a = await createSession({ userId: USER, tenantId: 't1' });
    await sleep(5);
    const b = await createSession({ userId: USER, tenantId: 't1' });
    await sleep(5);
    // Activity on the older session makes it the newest.
    await touchSession(a.sid, USER);
    const live = await listLiveSessions(USER);
    expect(live.map((s) => s.sid)).toEqual([b.sid, a.sid]);
  });
});

describe('session limiter policy', () => {
  it('allows logins under the limit', async () => {
    await createSession({ userId: USER, tenantId: 't1' });
    await createSession({ userId: USER, tenantId: 't1' });
    const verdict = await enforceSessionPolicy(USER, 3, 'BLOCK');
    expect(verdict.allowed).toBe(true);
  });

  it('BLOCK refuses the 4th device and reports active sessions', async () => {
    await createSession({ userId: USER, tenantId: 't1' });
    await createSession({ userId: USER, tenantId: 't1' });
    await createSession({ userId: USER, tenantId: 't1' });
    const verdict = await enforceSessionPolicy(USER, 3, 'BLOCK');
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.sessions).toHaveLength(3);
    }
    expect(await countLiveSessions(USER)).toBe(3);
  });

  it('EVICT_OLDEST evicts the least-recently-active session', async () => {
    const a = await createSession({ userId: USER, tenantId: 't1' });
    await sleep(5);
    const b = await createSession({ userId: USER, tenantId: 't1' });
    await sleep(5);
    const c = await createSession({ userId: USER, tenantId: 't1' });
    await sleep(5);
    await touchSession(a.sid, USER); // a is now most recent; b is oldest

    const verdict = await enforceSessionPolicy(USER, 3, 'EVICT_OLDEST');
    expect(verdict.allowed).toBe(true);
    expect(await sessionExists(b.sid)).toBe(false);
    expect(await sessionExists(a.sid)).toBe(true);
    expect(await sessionExists(c.sid)).toBe(true);
    expect(await countLiveSessions(USER)).toBe(2); // room for the new login
  });

  it('a session with no screen open holds no seat', async () => {
    const a = await createSession({ userId: USER, tenantId: 't1' });
    await createSession({ userId: USER, tenantId: 't1' });
    await closeScreen(a.sid);

    expect(await countLiveSessions(USER)).toBe(2); // still logged in on both
    expect(await countActiveSessions(USER)).toBe(1); // one screen actually open
    expect((await listActiveSessions(USER)).map((s) => s.sid)).not.toContain(a.sid);
  });

  it('lets a student in when every earlier login has been left behind', async () => {
    // The reported bug: a phone that gets a new IP on every login piled up a
    // session per login until BLOCK locked the student out of their own account.
    for (let i = 0; i < 10; i++) {
      const { sid } = await createSession({ userId: USER, tenantId: 't1' });
      await closeScreen(sid);
    }
    const verdict = await enforceSessionPolicy(USER, 10, 'BLOCK');
    expect(verdict.allowed).toBe(true);
    // ...and nobody was signed out to make room.
    expect(await countLiveSessions(USER)).toBe(10);
  });

  it('BLOCK still refuses when the seats are held by screens open right now', async () => {
    const open = [];
    for (let i = 0; i < 3; i++) open.push(await createSession({ userId: USER, tenantId: 't1' }));
    const { sid: closed } = await createSession({ userId: USER, tenantId: 't1' });
    await closeScreen(closed);

    const verdict = await enforceSessionPolicy(USER, 3, 'BLOCK');
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      // Only the open screens are reported back for the student to close.
      expect(verdict.sessions.map((s) => s.sid).sort()).toEqual(open.map((s) => s.sid).sort());
    }
  });

  it('a screen that keeps pinging keeps its seat', async () => {
    const a = await createSession({ userId: USER, tenantId: 't1' });
    await createSession({ userId: USER, tenantId: 't1' });
    await closeScreen(a.sid);
    expect((await enforceSessionPolicy(USER, 2, 'BLOCK')).allowed).toBe(true);

    // The SSE stream / heartbeat pings: that screen is open after all.
    await touchSession(a.sid, USER);
    expect((await enforceSessionPolicy(USER, 2, 'BLOCK')).allowed).toBe(false);
  });

  it('EVICT_OLDEST frees the oldest open screen and leaves closed ones signed in', async () => {
    const { sid: closed } = await createSession({ userId: USER, tenantId: 't1' });
    await closeScreen(closed);
    const a = await createSession({ userId: USER, tenantId: 't1' });
    await sleep(5);
    const b = await createSession({ userId: USER, tenantId: 't1' });

    const verdict = await enforceSessionPolicy(USER, 2, 'EVICT_OLDEST');
    expect(verdict.allowed).toBe(true);
    expect(await sessionExists(a.sid)).toBe(false); // oldest open screen yielded
    expect(await sessionExists(b.sid)).toBe(true);
    expect(await sessionExists(closed)).toBe(true); // untouched — no seat, no eviction
  });

  it('a dead session does not count toward the limit', async () => {
    await createSession({ userId: USER, tenantId: 't1' });
    await createSession({ userId: USER, tenantId: 't1' });
    const { sid } = await createSession({ userId: USER, tenantId: 't1' });
    // Simulate TTL expiry: hash gone, index entry stale.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getRedis() as any).del(`sess:${sid}`);
    const verdict = await enforceSessionPolicy(USER, 3, 'BLOCK');
    expect(verdict.allowed).toBe(true);
  });
});

describe('refresh token rotation', () => {
  it('replays the same rotation for a token replaced within the grace window', async () => {
    const { sid, refreshToken } = await createSession({ userId: USER, tenantId: 't1' });
    const first = await rotateRefreshToken(sid, refreshToken);
    expect(first.ok).toBe(true);

    // Concurrent-refresh race: same token presented again moments later gets
    // the same rotated token back instead of killing the session.
    const replay = await rotateRefreshToken(sid, refreshToken);
    expect(replay.ok).toBe(true);
    if (first.ok && replay.ok) expect(replay.refreshToken).toBe(first.refreshToken);
    expect(await sessionExists(sid)).toBe(true);
  });

  it('treats reuse after the grace window as theft and kills the session', async () => {
    const { sid, refreshToken } = await createSession({ userId: USER, tenantId: 't1' });
    const first = await rotateRefreshToken(sid, refreshToken);
    expect(first.ok).toBe(true);

    // Simulate the grace record expiring.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getRedis() as any).del(`sess:${sid}:rotation`);

    const reuse = await rotateRefreshToken(sid, refreshToken);
    expect(reuse.ok).toBe(false);
    if (!reuse.ok) expect(reuse.reason).toBe('reused');
    expect(await sessionExists(sid)).toBe(false);
  });

  it('concurrent rotations of the same token converge on one new token', async () => {
    const { sid, refreshToken } = await createSession({ userId: USER, tenantId: 't1' });
    const [a, b] = await Promise.all([
      rotateRefreshToken(sid, refreshToken),
      rotateRefreshToken(sid, refreshToken),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.refreshToken).toBe(b.refreshToken);
    expect(await sessionExists(sid)).toBe(true);

    // The surviving token keeps working.
    if (a.ok) {
      const next = await rotateRefreshToken(sid, a.refreshToken);
      expect(next.ok).toBe(true);
    }
  });

  it('accepts the newest token across multiple rotations', async () => {
    const { sid, refreshToken } = await createSession({ userId: USER, tenantId: 't1' });
    let token = refreshToken;
    for (let i = 0; i < 3; i++) {
      const rotated = await rotateRefreshToken(sid, token);
      expect(rotated.ok).toBe(true);
      if (rotated.ok) token = rotated.refreshToken;
    }
    expect(await sessionExists(sid)).toBe(true);
  });

  it('fails for a nonexistent session', async () => {
    const out = await rotateRefreshToken('no-such-sid', 'whatever');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('invalid');
  });
});
