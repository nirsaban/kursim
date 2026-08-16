import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { apiError, clientIp, parseBody } from '@/lib/api';
import { autoEnrollSchema } from '@/lib/validation/schemas';
import { asSuperAdmin, forTenant } from '@/lib/tenant/scoped-prisma';
import { hashApiKey } from '@/lib/api-keys';
import { hashPassword } from '@/lib/auth/password';
import { rateLimit } from '@/lib/rate-limit';
import { fireWelcomeAutomations } from '@/lib/automations';
import { studentSeatGate } from '@/lib/billing-server';

/**
 * Public auto-enroll endpoint for payment processors and funnels, matching the
 * snippet generator on the admin API page:
 *
 *   POST /api/v1/automation
 *   Authorization: Bearer <tenant API key>
 *   { "email": "...", "full_name": "...", "course_ids": ["..."], "action": "enroll" }
 *
 * The key resolves the tenant; course_ids outside that tenant are reported in
 * `skipped` rather than enrolled (the scoped client can't even see them).
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const ipGate = await rateLimit('api_v1', ip, { limit: 60, windowSec: 60 });
  if (!ipGate.allowed) return apiError(429, 'rate_limited');

  const header = req.headers.get('authorization') ?? '';
  const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!presented) return apiError(401, 'missing_api_key');

  // Key lookup is cross-tenant by nature — the key IS the tenant selector.
  const apiKey = await asSuperAdmin().apiKey.findUnique({
    where: { keyHash: hashApiKey(presented) },
  });
  if (!apiKey) return apiError(401, 'invalid_api_key');

  const parsed = await parseBody(req, autoEnrollSchema);
  if ('error' in parsed) return parsed.error;
  const { email, full_name, course_ids } = parsed.data;

  const db = forTenant(apiKey.tenantId);
  await db.apiKey.updateMany({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

  // Find or create the student (mustChangePassword, like every provisioned account).
  const normalized = email.toLowerCase();
  let user = await db.user.findFirst({ where: { email: normalized } });
  let userCreated = false;
  if (!user) {
    const gate = await studentSeatGate(db, apiKey.tenantId);
    if (gate) return gate;
    user = await db.user.create({
      data: {
        tenantId: apiKey.tenantId,
        email: normalized,
        name: full_name || undefined,
        passwordHash: await hashPassword(randomBytes(9).toString('base64url')),
        role: 'STUDENT',
        status: 'ACTIVE',
        mustChangePassword: true,
      },
    });
    userCreated = true;
  }
  if (user.role !== 'STUDENT') return apiError(403, 'not_a_student_account');

  const enrolled: string[] = [];
  const skipped: string[] = [];
  for (const courseId of course_ids) {
    const course = await db.course.findFirst({ where: { id: courseId } });
    if (!course) {
      skipped.push(courseId);
      continue;
    }
    const existing = await db.enrollment.findFirst({
      where: { studentId: user.id, courseId },
    });
    if (!existing) {
      await db.enrollment.create({
        data: { tenantId: apiKey.tenantId, studentId: user.id, courseId },
      });
    }
    enrolled.push(courseId);
  }
  if (enrolled.length > 0) {
    await fireWelcomeAutomations(db, apiKey.tenantId, user.id, enrolled[0]);
  }

  return NextResponse.json({
    ok: true,
    user_created: userCreated,
    enrolled,
    skipped,
  });
}
