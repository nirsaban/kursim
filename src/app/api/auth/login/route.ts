import { NextResponse } from 'next/server';
import { apiError, clientIp, parseBody } from '@/lib/api';
import { loginSchema } from '@/lib/validation/schemas';
import { rateLimit, LOGIN_LIMIT } from '@/lib/rate-limit';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant, asSuperAdmin } from '@/lib/tenant/scoped-prisma';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { signAccessToken } from '@/lib/auth/jwt';
import { createSession } from '@/lib/session-registry/registry';
import { enforceSessionPolicy } from '@/lib/session-registry/policy';
import { deviceLabelFromUa } from '@/lib/auth/device';
import { setAuthCookies } from '@/lib/auth/issue';

// Verified against when the user doesn't exist, so response timing doesn't
// reveal which emails are registered.
const dummyHashPromise = hashPassword('kursim-timing-equalizer');

const invalidCredentials = () => apiError(401, 'invalid_credentials');

// Session policy for super-admins (tenants configure their own).
const SUPER_ADMIN_SESSION_LIMIT = 5;

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

  const limit = tenant?.sessionLimit ?? SUPER_ADMIN_SESSION_LIMIT;
  const policy = tenant?.evictionPolicy ?? 'EVICT_OLDEST';
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
