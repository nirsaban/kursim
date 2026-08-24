import type { TenantClient } from '@/lib/tenant/scoped-prisma';
import { marketingSchema, parseMarketing } from '@/lib/validation/marketing';

/** Same cap the publish editor enforces on checkoutAddons. */
const MAX_ADDONS = 3;

/**
 * Make every priced course in a collection offer the other priced collection
 * courses as opt-in add-ons at its own checkout, at their full price.
 *
 * This only ADDS to `marketing.checkoutAddons` through the existing,
 * server-priced add-on mechanism (resolveOffer/priceOrder re-validate every
 * add-on against the tenant at payment time). Existing add-ons and their
 * prices are never touched, bundled courses are skipped (the bundle wins), and
 * the 3-add-on cap is respected — so it can never change what an existing
 * buyer is charged for a basket they already saw.
 */
export async function syncCrossAddons(db: TenantClient, courseIds: string[]): Promise<void> {
  const courses = await db.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true, priceAgorot: true, marketing: true },
  });
  const priced = courses.filter((c) => c.priceAgorot && c.priceAgorot > 0);
  for (const course of priced) {
    const m = parseMarketing(course.marketing);
    const have = new Set(m.checkoutAddons.map((a) => a.courseId));
    const bundled = new Set(m.bundleCourseIds);
    const addons = [...m.checkoutAddons];
    for (const other of priced) {
      if (addons.length >= MAX_ADDONS) break;
      if (other.id === course.id || have.has(other.id) || bundled.has(other.id)) continue;
      addons.push({ courseId: other.id, priceAgorot: other.priceAgorot! });
      have.add(other.id);
    }
    if (addons.length === m.checkoutAddons.length) continue;
    const next = marketingSchema.safeParse({ ...m, checkoutAddons: addons });
    if (!next.success) continue;
    await db.course.update({ where: { id: course.id }, data: { marketing: next.data } });
  }
}
