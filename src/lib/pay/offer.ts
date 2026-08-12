import type { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseMarketing } from '@/lib/validation/marketing';

/**
 * What one course actually sells: its own price, whatever rides along with it,
 * and whatever the buyer may add on top.
 *
 * Three shapes of "buy the second course too" all land here:
 *   - free bundle      — `bundleCourseIds` with no `bundlePriceAgorot`
 *   - discounted bundle — `bundleCourseIds` + `bundlePriceAgorot`
 *   - opt-in add-on    — `checkoutAddons`, priced and ticked per order
 *
 * The landing page, the checkout page and the start-payment route all resolve
 * the offer through here, so the price advertised, the price shown and the
 * price signed to Hyp cannot drift apart. Everything is read from the database
 * through the tenant-scoped client: an id left behind by a deleted course, or
 * one belonging to another tenant, simply drops out of the offer.
 */

type ScopedDb = ReturnType<typeof forTenant>;

/** A course the buyer may tick at checkout, with what ticking it costs. */
export type OfferAddon = { id: string; title: string; priceAgorot: number };

export type CourseOffer = {
  /** Course ids the base price grants, primary first. */
  includedIds: string[];
  /** Their titles, in the same order — what the checkout lists. */
  includedTitles: string[];
  /** What the base purchase costs: the bundle price when the seller set one. */
  baseAgorot: number;
  /**
   * Sum of the included courses' own prices, when that's more than what we
   * actually charge — the crossed-out "instead of" number. Null when there's
   * nothing to compare against.
   */
  strikeAgorot: number | null;
  addons: OfferAddon[];
};

type CourseForOffer = {
  id: string;
  title: string;
  priceAgorot: number | null;
  marketing: unknown;
};

/**
 * Resolve a course's full offer, or null when it isn't sold through checkout
 * at all (no price — the landing CTA falls back to the legacy payment link).
 */
export async function resolveOffer(
  db: ScopedDb,
  course: CourseForOffer,
): Promise<CourseOffer | null> {
  if (!course.priceAgorot || course.priceAgorot <= 0) return null;

  const m = parseMarketing(course.marketing);
  // Never bundle or upsell the course with itself — that would double-enroll.
  const bundleIds = m.bundleCourseIds.filter((id) => id !== course.id);
  // An add-on that's already free in the bundle would charge for what the
  // buyer is getting anyway; the bundle wins.
  const addons = m.checkoutAddons.filter(
    (a) => a.courseId !== course.id && !bundleIds.includes(a.courseId),
  );

  const otherIds = [...new Set([...bundleIds, ...addons.map((a) => a.courseId)])];
  const others = otherIds.length
    ? await db.course.findMany({
        where: { id: { in: otherIds } },
        select: { id: true, title: true, priceAgorot: true },
      })
    : [];
  const byId = new Map(others.map((c) => [c.id, c]));

  // Keep the seller's declared order, primary course first.
  const included = bundleIds.map((id) => byId.get(id)).filter((c) => Boolean(c)) as Array<{
    id: string;
    title: string;
    priceAgorot: number | null;
  }>;

  const discounted = included.length > 0 && m.bundlePriceAgorot && m.bundlePriceAgorot > 0;
  const baseAgorot = discounted ? m.bundlePriceAgorot! : course.priceAgorot;
  const listAgorot =
    course.priceAgorot + included.reduce((sum, c) => sum + (c.priceAgorot ?? 0), 0);

  return {
    includedIds: [course.id, ...included.map((c) => c.id)],
    includedTitles: [course.title, ...included.map((c) => c.title)],
    baseAgorot,
    strikeAgorot: listAgorot > baseAgorot ? listAgorot : null,
    addons: addons
      .filter((a) => byId.has(a.courseId))
      .map((a) => ({ id: a.courseId, title: byId.get(a.courseId)!.title, priceAgorot: a.priceAgorot })),
  };
}

/**
 * Price an order: the base plus whichever add-ons the buyer ticked.
 *
 * Returns null if the request names an add-on this offer doesn't have, rather
 * than quietly dropping it — a buyer who thinks they're buying two courses
 * must not be charged for one and enrolled in one.
 */
export function priceOrder(
  offer: CourseOffer,
  addonCourseIds: string[],
): { totalAgorot: number; courseIds: string[]; titles: string[] } | null {
  const picked: OfferAddon[] = [];
  for (const id of new Set(addonCourseIds)) {
    const addon = offer.addons.find((a) => a.id === id);
    if (!addon) return null;
    picked.push(addon);
  }
  return {
    totalAgorot: offer.baseAgorot + picked.reduce((sum, a) => sum + a.priceAgorot, 0),
    courseIds: [...offer.includedIds, ...picked.map((a) => a.id)],
    titles: [...offer.includedTitles, ...picked.map((a) => a.title)],
  };
}
