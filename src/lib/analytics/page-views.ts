import { createHash } from 'crypto';
import { getRedis } from '@/lib/redis';
import { prisma } from '@/lib/tenant/prisma';
import { forTenant } from '@/lib/tenant/scoped-prisma';

/**
 * True the first time this (IP, user-agent) pair is seen for `namespace:id`
 * — a Redis set dedupes so refreshes/repeat visits don't inflate a counter.
 * Same scheme as AffiliateLink.visits' original inline version.
 */
export async function isNewVisitor(
  namespace: string,
  id: string,
  ip: string,
  ua: string,
): Promise<boolean> {
  const hash = createHash('sha256').update(`${ip}|${ua}`).digest('hex');
  const isNew = await getRedis().sadd(`${namespace}:${id}`, hash);
  return isNew === 1;
}

/** Unique visitor to one course's public landing page — every visit, not just ?ref= ones. */
export async function trackCourseLandingView(
  tenantId: string,
  courseId: string,
  ip: string,
  ua: string,
): Promise<void> {
  if (!(await isNewVisitor('landing:visitors', courseId, ip, ua))) return;
  await forTenant(tenantId).course.update({
    where: { id: courseId },
    data: { landingViews: { increment: 1 } },
  });
}

/** Unique visitor to the tenant's public linktree page. Tenant has no RLS — see resolve.ts. */
export async function trackLinktreeView(tenantId: string, ip: string, ua: string): Promise<void> {
  if (!(await isNewVisitor('linktree:visitors', tenantId, ip, ua))) return;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { linktreeViews: { increment: 1 } },
  });
}
