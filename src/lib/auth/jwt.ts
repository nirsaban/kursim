import { SignJWT, jwtVerify } from 'jose';

export type Role = 'SUPER_ADMIN' | 'OWNER' | 'INSTRUCTOR' | 'STUDENT';

export interface AccessClaims {
  /** user id */
  sub: string;
  tenantId: string | null;
  tenantSlug: string | null;
  role: Role;
  /** session id (Redis registry key) */
  sid: string;
  jti: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret === 'change-me-to-a-long-random-string') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be set to a strong random value in production');
    }
  }
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(secret);
}

export function accessTokenTtlSeconds(): number {
  return Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 600);
}

export async function signAccessToken(claims: Omit<AccessClaims, 'jti'>): Promise<string> {
  return new SignJWT({
    tenantId: claims.tenantId,
    tenantSlug: claims.tenantSlug,
    role: claims.role,
    sid: claims.sid,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${accessTokenTtlSeconds()}s`)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (!payload.sub || typeof payload.sid !== 'string' || typeof payload.role !== 'string') {
      return null;
    }
    return {
      sub: payload.sub,
      tenantId: (payload.tenantId as string | null) ?? null,
      tenantSlug: (payload.tenantSlug as string | null) ?? null,
      role: payload.role as Role,
      sid: payload.sid,
      jti: (payload.jti as string) ?? '',
    };
  } catch {
    return null;
  }
}
