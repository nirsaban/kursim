import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiError, clientIp, parseBody } from '@/lib/api';
import { loginSchema } from '@/lib/validation/schemas';
import { rateLimit, LOGIN_LIMIT } from '@/lib/rate-limit';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant, asSuperAdmin } from '@/lib/tenant/scoped-prisma';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { signAccessToken } from '@/lib/auth/jwt';
import {
  createSession,
  evictSession,
  sessionExists,
} from '@/lib/session-registry/registry';
import { enforceSessionPolicy } from '@/lib/session-registry/policy';
import { deviceLabelFromUa } from '@/lib/auth/device';
import { parseRefreshCookie, setAuthCookies } from '@/lib/auth/issue';
import { REFRESH_COOKIE } from '@/lib/auth/cookies';

// Verified against when the user doesn't exist, so response timing doesn't
// reveal which emails are registered.
const dummyHashPromise = hashPassword('kursim-timing-equalizer');

const invalidCredentials = () => apiError(401, 'invalid_credentials');

// Session policy for super-admins (tenants configure their own).
const SUPER_ADMIN_SESSION_LIMIT = 5;
// Owners and instructors are exempt from the tenant's student device limit —
// see the comment at the call site.
const STAFF_SESSION_LIMIT = 20;

export async function POST(req: Request) {
  const parsed = await parseBody(req, loginSchema);
  if ('error' in parsed) return parsed.error;
  const { email, password, tenantSlug } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const ip = clientIp(req);

  const [byIp, byEmail] = await Promise.all([
    rateLimit('login-ip', ip, LOGIN_LIMIT),
    rateLimit('login-email', `${tenantSlug ?? 'super'}:${normalizedEmail}`, LOGIN_LIMIT),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    return apiError(429, 'too_many_attempts', {
      retryAfterSec: Math.max(byIp.retryAfterSec, byEmail.retryAfterSec),
    });
  }

  let tenant = null;
  let user = null;
  if (tenantSlug) {
    tenant = await getTenantBySlug(tenantSlug);
    if (!tenant || tenant.status !== 'ACTIVE') return invalidCredentials();
    user = await forTenant(tenant.id).user.findFirst({ where: { email: normalizedEmail } });
  } else {
    user = await asSuperAdmin().user.findFirst({
      where: { email: normalizedEmail, role: 'SUPER_ADMIN', tenantId: null },
    });
  }

  const passwordOk = await verifyPassword(user?.passwordHash ?? (await dummyHashPromise), password);
  if (!user || !passwordOk) return invalidCredentials();
  if (user.status !== 'ACTIVE') return apiError(403, 'account_suspended');

  // A browser re-logging-in still carries its previous session cookie.
  // Replace that session instead of stacking a new one, so the limiter counts
  // screens, not logins. Possession of the httpOnly sid grants the same power
  // as logout over that session, and the cookie is overwritten below either
  // way — even if it belonged to a different account on a shared browser.
  const prior = parseRefreshCookie((await cookies()).get(REFRESH_COOKIE)?.value);
  if (prior && (await sessionExists(prior.sid))) {
    await evictSession(prior.sid, { notify: false });
  }

  // The device limit exists to stop students from sharing a paid account. Staff
  // aren't that risk — they legitimately work from phone, laptop and desk — and
  // locking an owner out of their own school is far worse than the sharing it
  // would prevent. They still get a generous cap so a leaked staff password
  // can't spawn sessions without bound.
  const isStaff = user.role === 'OWNER' || user.role === 'INSTRUCTOR';
  const limit = isStaff
    ? STAFF_SESSION_LIMIT
    : (tenant?.sessionLimit ?? SUPER_ADMIN_SESSION_LIMIT);
  // Staff never hit a wall: the oldest seat yields instead of refusing entry.
  const policy = isStaff ? 'EVICT_OLDEST' : (tenant?.evictionPolicy ?? 'EVICT_OLDEST');
  // Seats are held by screens that are open right now — a session with no
  // screen behind it stops counting on its own (see session-registry/window.ts)
  // — so nothing has to be swept here. The previous rule evicted every session
  // sharing this IP to stop old logins piling up; with screens counted instead
  // of logins that sweep only ever cost someone else in the house their live
  // session.
  const verdict = await enforceSessionPolicy(user.id, limit, policy);
  if (!verdict.allowed) {
    return apiError(401, 'device_limit', {
      sessions: verdict.sessions.map((s) => ({
        deviceLabel: s.deviceLabel,
        ip: s.ip,
        lastSeenAt: s.lastSeenAt,
        createdAt: s.createdAt,
      })),
    });
  }

  const ua = req.headers.get('user-agent') ?? '';
  const { sid, refreshToken } = await createSession({
    userId: user.id,
    tenantId: tenant?.id ?? null,
    ua,
    ip,
    deviceLabel: deviceLabelFromUa(ua),
  });

  const accessToken = await signAccessToken({
    sub: user.id,
    tenantId: tenant?.id ?? null,
    tenantSlug: tenant?.slug ?? null,
    role: user.role,
    sid,
  });

  const db = tenant ? forTenant(tenant.id) : asSuperAdmin();
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const redirect =
    user.role === 'SUPER_ADMIN'
      ? '/superadmin'
      : user.role === 'STUDENT'
        ? `/t/${tenant!.slug}`
        : `/t/${tenant!.slug}/admin`;

  const res = NextResponse.json({
    ok: true,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    redirect,
  });
  setAuthCookies(res, accessToken, sid, refreshToken);
  return res;
}
