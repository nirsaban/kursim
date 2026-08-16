import { NextResponse } from 'next/server';
import { apiError, clientIp, parseBody } from '@/lib/api';
import { signupSchema } from '@/lib/validation/schemas';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/tenant/prisma';
import { asSuperAdmin } from '@/lib/tenant/scoped-prisma';
import { hashPassword } from '@/lib/auth/password';
import { signAccessToken } from '@/lib/auth/jwt';
import { createSession } from '@/lib/session-registry/registry';
import { deviceLabelFromUa } from '@/lib/auth/device';
import { setAuthCookies } from '@/lib/auth/issue';

// Opening a school is rare per human, cheap to farm per bot.
const SIGNUP_LIMIT = { limit: 5, windowSec: 3600 };

// Route namespace that would shadow real pages if taken as a school address.
const RESERVED_SLUGS = new Set(['t', 'api', 'superadmin', 'signup', 'admin', 'www']);

/**
 * Public self-serve signup: creates a FREE school + its owner and signs them
 * straight in. FREE builds everything; the paywall waits at invite/publish.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit('signup', ip, SIGNUP_LIMIT);
  if (!rl.allowed) return apiError(429, 'too_many_attempts');

  const parsed = await parseBody(req, signupSchema);
  if ('error' in parsed) return parsed.error;
  const { schoolName, slug, email, password, name } = parsed.data;

  if (RESERVED_SLUGS.has(slug)) return apiError(409, 'slug_taken');
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) return apiError(409, 'slug_taken');

  const tenant = await asSuperAdmin().tenant.create({
    data: { slug, name: schoolName, plan: 'FREE' },
  });
  const user = await asSuperAdmin().user.create({
    data: {
      tenantId: tenant.id,
      email: email.toLowerCase(),
      name,
      passwordHash: await hashPassword(password),
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  const ua = req.headers.get('user-agent') ?? '';
  const { sid, refreshToken } = await createSession({
    userId: user.id,
    tenantId: tenant.id,
    ua,
    ip,
    deviceLabel: deviceLabelFromUa(ua),
  });
  const accessToken = await signAccessToken({
    sub: user.id,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    role: 'OWNER',
    sid,
  });

  const res = NextResponse.json(
    { ok: true, redirect: `/t/${tenant.slug}/admin` },
    { status: 201 },
  );
  setAuthCookies(res, accessToken, sid, refreshToken);
  return res;
}
