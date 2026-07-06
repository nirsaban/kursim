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
  killAllSessions,
  rotateRefreshToken,
} from '@/lib/session-registry/registry';
import { enforceSessionPolicy } from '@/lib/session-registry/policy';

const USER = 'user-1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  it('rotates on valid use and old token becomes unusable', async () => {
    const { sid, refreshToken } = await createSession({ userId: USER, tenantId: 't1' });
    const first = await rotateRefreshToken(sid, refreshToken);
    expect(first.ok).toBe(true);

    // Reusing the original (already rotated) token = assumed theft → session killed.
    const reuse = await rotateRefreshToken(sid, refreshToken);
    expect(reuse.ok).toBe(false);
    if (!reuse.ok) expect(reuse.reason).toBe('reused');
    expect(await sessionExists(sid)).toBe(false);
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
