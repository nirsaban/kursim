import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { REFRESH_COOKIE } from '@/lib/auth/cookies';
import { clearAuthCookies, parseRefreshCookie, setAuthCookies } from '@/lib/auth/issue';
import { signAccessToken, Role } from '@/lib/auth/jwt';
import { getSession, rotateRefreshToken, touchSession, evictSession } from '@/lib/session-registry/registry';
import { rateLimit, REFRESH_LIMIT } from '@/lib/rate-limit';
import { prisma } from '@/lib/tenant/prisma';
import { forTenant, asSuperAdmin } from '@/lib/tenant/scoped-prisma';

interface RefreshOutcome {
  ok: boolean;
  accessToken?: string;
  sid?: string;
  refreshToken?: string;
}

async function performRefresh(): Promise<RefreshOutcome> {
  const store = await cookies();
  const parsed = parseRefreshCookie(store.get(REFRESH_COOKIE)?.value);
  if (!parsed) return { ok: false };
  const { sid, token } = parsed;

  const rl = await rateLimit('refresh', sid, REFRESH_LIMIT);
  if (!rl.allowed) return { ok: false };

  const session = await getSession(sid);
  if (!session) return { ok: false };

  // Look up the user + tenant to rebuild claims and re-check status.
  const tenant = session.tenantId
    ? await prisma.tenant.findUnique({ where: { id: session.tenantId } })
    : null;
  if (session.tenantId && (!tenant || tenant.status !== 'ACTIVE')) {
    await evictSession(sid);
    return { ok: false };
  }
  const db = tenant ? forTenant(tenant.id) : asSuperAdmin();
  const user = await db.user.findFirst({ where: { id: session.userId } });
  if (!user || user.status !== 'ACTIVE') {
    await evictSession(sid);
    return { ok: false };
  }

  const rotated = await rotateRefreshToken(sid, token);
  if (!rotated.ok) return { ok: false };

  await touchSession(sid, session.userId);
  const accessToken = await signAccessToken({
    sub: user.id,
    tenantId: tenant?.id ?? null,
    tenantSlug: tenant?.slug ?? null,
    role: user.role as Role,
    sid,
  });
  return { ok: true, accessToken, sid, refreshToken: rotated.refreshToken };
}

export async function POST() {
  const out = await performRefresh();
  if (!out.ok) {
    const res = NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    clearAuthCookies(res);
    return res;
  }
  const res = NextResponse.json({ ok: true });
  setAuthCookies(res, out.accessToken!, out.sid!, out.refreshToken!);
  return res;
}

/** Middleware redirects here when the access token expired but a refresh cookie exists. */
export async function GET(req: NextRequest) {
  const nextParam = req.nextUrl.searchParams.get('next') ?? '/';
  // Only same-origin relative paths.
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';

  const out = await performRefresh();
  if (!out.ok) {
    const tenantMatch = next.match(/^\/t\/([^/]+)/);
    const loginPath = tenantMatch ? `/t/${tenantMatch[1]}/login` : '/superadmin/login';
    const loginUrl = new URL(loginPath, req.url);
    loginUrl.searchParams.set('next', next);
    const res = NextResponse.redirect(loginUrl);
    clearAuthCookies(res);
    return res;
  }
  const res = NextResponse.redirect(new URL(next, req.url));
  setAuthCookies(res, out.accessToken!, out.sid!, out.refreshToken!);
  return res;
}
