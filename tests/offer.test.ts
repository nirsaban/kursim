import { describe, expect, it } from 'vitest';
import { priceOrder, resolveOffer, type CourseOffer } from '@/lib/pay/offer';

const BASE = '11111111-1111-1111-1111-111111111111';
const SECOND = '22222222-2222-2222-2222-222222222222';
const THIRD = '33333333-3333-3333-3333-333333333333';
const GONE = '44444444-4444-4444-4444-444444444444';

const CATALOG = [
  { id: SECOND, title: 'קורס ב', priceAgorot: 19900 },
  { id: THIRD, title: 'קורס ג', priceAgorot: 9900 },
];

/**
 * Stands in for the tenant-scoped client: it only ever answers with courses
 * this tenant owns, which is exactly how a deleted or cross-tenant id
 * disappears from an offer in production.
 */
function fakeDb(catalog = CATALOG) {
  return {
    course: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        catalog.filter((c) => where.id.in.includes(c.id)),
    },
  } as unknown as Parameters<typeof resolveOffer>[0];
}

function course(marketing: Record<string, unknown>, priceAgorot: number | null = 29900) {
  return { id: BASE, title: 'קורס א', priceAgorot, marketing };
}

describe('resolveOffer', () => {
  it('returns null for a course with no price', async () => {
    expect(await resolveOffer(fakeDb(), course({}, null))).toBeNull();
    expect(await resolveOffer(fakeDb(), course({}, 0))).toBeNull();
  });

  it('charges the course price when the bundle rides along free', async () => {
    const offer = (await resolveOffer(fakeDb(), course({ bundleCourseIds: [SECOND] })))!;
    expect(offer.baseAgorot).toBe(29900);
    expect(offer.includedIds).toEqual([BASE, SECOND]);
    expect(offer.includedTitles).toEqual(['קורס א', 'קורס ב']);
    // ₪299 + ₪199 separately, ₪299 together.
    expect(offer.strikeAgorot).toBe(49800);
  });

  it('charges the bundle price when one is set', async () => {
    const offer = (await resolveOffer(
      fakeDb(),
      course({ bundleCourseIds: [SECOND], bundlePriceAgorot: 39900 }),
    ))!;
    expect(offer.baseAgorot).toBe(39900);
    expect(offer.strikeAgorot).toBe(49800);
  });

  it('ignores a bundle price when nothing is bundled', async () => {
    const offer = (await resolveOffer(fakeDb(), course({ bundlePriceAgorot: 100 })))!;
    expect(offer.baseAgorot).toBe(29900);
    expect(offer.strikeAgorot).toBeNull();
  });

  it('drops bundled courses that no longer exist', async () => {
    const offer = (await resolveOffer(fakeDb(), course({ bundleCourseIds: [GONE, SECOND] })))!;
    expect(offer.includedIds).toEqual([BASE, SECOND]);
  });

  it('never bundles or upsells the course with itself', async () => {
    const offer = (await resolveOffer(
      fakeDb(),
      course({ bundleCourseIds: [BASE], checkoutAddons: [{ courseId: BASE, priceAgorot: 100 }] }),
    ))!;
    expect(offer.includedIds).toEqual([BASE]);
    expect(offer.addons).toEqual([]);
  });

  it('prices add-ons from the seller list, not the course price', async () => {
    const offer = (await resolveOffer(
      fakeDb(),
      course({ checkoutAddons: [{ courseId: SECOND, priceAgorot: 9900 }] }),
    ))!;
    // Course B lists at ₪199; as an add-on the seller charges ₪99.
    expect(offer.addons).toEqual([{ id: SECOND, title: 'קורס ב', priceAgorot: 9900 }]);
  });

  it('drops an add-on that is already free in the bundle', async () => {
    const offer = (await resolveOffer(
      fakeDb(),
      course({
        bundleCourseIds: [SECOND],
        checkoutAddons: [
          { courseId: SECOND, priceAgorot: 9900 },
          { courseId: THIRD, priceAgorot: 5000 },
        ],
      }),
    ))!;
    expect(offer.addons.map((a) => a.id)).toEqual([THIRD]);
  });

  it('drops an add-on pointing at a course this tenant does not own', async () => {
    const offer = (await resolveOffer(
      fakeDb(),
      course({ checkoutAddons: [{ courseId: GONE, priceAgorot: 9900 }] }),
    ))!;
    expect(offer.addons).toEqual([]);
  });
});

describe('priceOrder', () => {
  const offer: CourseOffer = {
    includedIds: [BASE, SECOND],
    includedTitles: ['קורס א', 'קורס ב'],
    baseAgorot: 39900,
    strikeAgorot: 49800,
    addons: [{ id: THIRD, title: 'קורס ג', priceAgorot: 9900 }],
  };

  it('charges the base alone when nothing is ticked', () => {
    expect(priceOrder(offer, [])).toEqual({
      totalAgorot: 39900,
      courseIds: [BASE, SECOND],
      titles: ['קורס א', 'קורס ב'],
    });
  });

  it('adds the ticked add-on to both the total and the granted courses', () => {
    expect(priceOrder(offer, [THIRD])).toEqual({
      totalAgorot: 49800,
      courseIds: [BASE, SECOND, THIRD],
      titles: ['קורס א', 'קורס ב', 'קורס ג'],
    });
  });

  it('counts a repeated add-on once', () => {
    expect(priceOrder(offer, [THIRD, THIRD])?.totalAgorot).toBe(49800);
  });

  it('refuses an add-on the offer does not have, rather than dropping it', () => {
    // Silently dropping would charge for one course and enroll in one while
    // the buyer believed they were buying two.
    expect(priceOrder(offer, [GONE])).toBeNull();
    expect(priceOrder(offer, [SECOND])).toBeNull();
  });
});
