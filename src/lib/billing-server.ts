import { prisma } from '@/lib/tenant/prisma';
import type { TenantClient } from '@/lib/tenant/scoped-prisma';
import { apiError } from '@/lib/api';
import { checkStudentSeats, normalizePlan, type Plan } from '@/lib/billing';

/** The tenant's current package (FREE when unset or unknown). */
export async function getTenantPlan(tenantId: string): Promise<Plan> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  return normalizePlan(tenant?.plan);
}

/**
 * Seat gate for anything that adds students. Returns null when allowed, or a
 * ready 402 whose body ({error, cap, plan}) the paywall UI renders directly.
 */
export async function studentSeatGate(
  db: TenantClient,
  tenantId: string,
  adding = 1,
): Promise<ReturnType<typeof apiError> | null> {
  const plan = await getTenantPlan(tenantId);
  const current = await db.user.count({ where: { role: 'STUDENT' } });
  const verdict = checkStudentSeats(plan, current, adding);
  if (verdict.ok) return null;
  return apiError(402, verdict.error, { plan, cap: verdict.cap, current });
}
