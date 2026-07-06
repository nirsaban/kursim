import { beforeAll, describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { signAccessToken, verifyAccessToken } from '@/lib/auth/jwt';

beforeAll(() => {
  process.env.AUTH_SECRET = 'test-secret-that-is-long-enough-for-hs256';
});

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword('S3cret-password');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'S3cret-password')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('S3cret-password');
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });

  it('rejects garbage hashes without throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });
});

describe('access tokens', () => {
  const claims = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'demo',
    role: 'STUDENT' as const,
    sid: 'sid-1',
  };

  it('round-trips claims', async () => {
    const token = await signAccessToken(claims);
    const verified = await verifyAccessToken(token);
    expect(verified).not.toBeNull();
    expect(verified!.sub).toBe('user-1');
    expect(verified!.tenantId).toBe('tenant-1');
    expect(verified!.tenantSlug).toBe('demo');
    expect(verified!.role).toBe('STUDENT');
    expect(verified!.sid).toBe('sid-1');
    expect(verified!.jti).toBeTruthy();
  });

  it('rejects tampered tokens', async () => {
    const token = await signAccessToken(claims);
    const tampered = token.slice(0, -3) + 'abc';
    expect(await verifyAccessToken(tampered)).toBeNull();
  });

  it('rejects tokens signed with a different secret', async () => {
    const token = await signAccessToken(claims);
    process.env.AUTH_SECRET = 'a-completely-different-secret-value!!';
    expect(await verifyAccessToken(token)).toBeNull();
    process.env.AUTH_SECRET = 'test-secret-that-is-long-enough-for-hs256';
  });

  it('rejects expired tokens', async () => {
    const prev = process.env.ACCESS_TOKEN_TTL_SECONDS;
    process.env.ACCESS_TOKEN_TTL_SECONDS = '-10';
    const token = await signAccessToken(claims);
    process.env.ACCESS_TOKEN_TTL_SECONDS = prev;
    expect(await verifyAccessToken(token)).toBeNull();
  });
});
