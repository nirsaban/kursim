import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ACCESS_COOKIE } from './cookies';
import { Role, verifyAccessToken } from './jwt';
import { sessionExists } from '@/lib/session-registry/registry';

export interface AuthContext {
  userId: string;
  tenantId: string | null;
  tenantSlug: string | null;
  role: Role;
  sid: string;
}

/**
 * Full auth check for server components and route handlers:
 * JWT signature/expiry AND Redis session liveness. A killed/evicted session
 * fails here immediately even though its JWT is still cryptographically valid.
 */
export async function getAuth(): Promise<AuthContext | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifyAccessToken(token);
  if (!claims) return null;
  if (!(await sessionExists(claims.sid))) return null;
  return {
    userId: claims.sub,
    tenantId: claims.tenantId,
    tenantSlug: claims.tenantSlug,
    role: claims.role,
    sid: claims.sid,
  };
}

/**
 * 401 without touching cookies. An expired access token is the NORMAL state
 * ten minutes after login — the client recovers via /api/auth/refresh, which
 * needs the refresh cookie intact. Only a failed refresh or explicit logout
 * may clear cookies; clearing them here logs users out at every access-token
 * expiry.
 */
export function unauthorized(message = 'unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Route-handler guard. Returns an AuthContext, or a ready NextResponse when
 * the request must be rejected. Usage:
 *   const g = await requireAuth({ roles: ['OWNER'], tenantSlug: slug });
 *   if (g instanceof NextResponse) return g;
 */
export async function requireAuth(opts?: {
  roles?: Role[];
  tenantSlug?: string;
}): Promise<AuthContext | NextResponse> {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  if (opts?.roles && !opts.roles.includes(auth.role)) return forbidden();
  if (opts?.tenantSlug !== undefined && auth.tenantSlug !== opts.tenantSlug) {
    return forbidden('tenant mismatch');
  }
  return auth;
}
