import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth/cookies';

/**
 * Edge middleware: verifies the JWT (signature/expiry) and that the token's
 * tenant matches the URL. Redis session liveness cannot run on the edge —
 * that check happens in lib/auth/guards.ts on every page/API access.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const tenantMatch = pathname.match(/^\/t\/([^/]+)(\/.*)?$/);
  const isSuperadminArea = pathname === '/superadmin' || pathname.startsWith('/superadmin/');
  if (!tenantMatch && !isSuperadminArea) return NextResponse.next();

  const slug = tenantMatch?.[1] ?? null;
  const rest = tenantMatch?.[2] ?? '';

  const loginPath = slug ? `/t/${slug}/login` : '/superadmin/login';
  const isLoginPage = pathname === loginPath;
  const isInvitePage = slug !== null && rest.startsWith('/invite');
  // Public course landing pages: /t/{slug}/c/{courseId}
  const isLandingPage = slug !== null && rest.startsWith('/c/');
  if (isLoginPage || isInvitePage || isLandingPage) return NextResponse.next();

  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  const claims = token ? await verifyAccessToken(token) : null;

  if (!claims) {
    // Expired/missing access token but a refresh cookie exists → try a
    // rotate-and-redirect through the refresh endpoint (Node runtime).
    if (req.cookies.get(REFRESH_COOKIE)?.value) {
      const refreshUrl = new URL('/api/auth/refresh', req.url);
      refreshUrl.searchParams.set('next', pathname + search);
      return NextResponse.redirect(refreshUrl);
    }
    const loginUrl = new URL(loginPath, req.url);
    loginUrl.searchParams.set('next', pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (slug) {
    // Tenant area: token must belong to this tenant (super-admin has no access to tenant UI).
    if (claims.tenantSlug !== slug) {
      return NextResponse.redirect(new URL(loginPath, req.url));
    }
    if (rest.startsWith('/admin') && claims.role !== 'OWNER' && claims.role !== 'INSTRUCTOR') {
      return NextResponse.redirect(new URL(`/t/${slug}`, req.url));
    }
  } else if (isSuperadminArea && claims.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/superadmin/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/t/:path*', '/superadmin/:path*'],
};
