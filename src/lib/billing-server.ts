import { prisma } from '@/lib/tenant/prisma';
import type { TenantClient } from '@/lib/tenant/scoped-prisma';
import { apiError } from '@/lib/api';
import {
  checkStudentSeats,
  getPackages,
  normalizePlan,
  type PackageOffer,
  type Plan,
} from '@/lib/billing';

/** Shape of the super-admin-editable 'packages' PlatformSetting. */
export interface PackagesOverride {
  [plan: string]: { price?: string; link?: string };
}

/**
 * The three packages with super-admin overrides applied. DB wins, then the
 * GROW_PLAN_LINK_* env defaults inside getPackages() — so the platform works
 * before anything was configured, and the super-admin can change prices and
 * payment links without touching the server.
 */
export async function loadPackages(): Promise<PackageOffer[]> {
  const base = getPackages();
  try {
    const row = await prisma.platformSetting.findUnique({ where: { key: 'packages' } });
    const overrides = (row?.value ?? {}) as PackagesOverride;
    return base.map((p) => {
      const o = overrides[p.plan];
      return {
        ...p,
        priceMonthly: o?.price?.trim() || p.priceMonthly,
        growLink: o?.link?.trim() ?? p.growLink,
      };
    });
  } catch {
    return base;
  }
}

export async function savePackagesOverride(value: PackagesOverride): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key: 'packages' },
    update: { value },
    create: { key: 'packages', value },
  });
}

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
