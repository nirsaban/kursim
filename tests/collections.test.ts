import { describe, expect, it } from 'vitest';
import { syncCrossAddons } from '@/lib/collections';
import { collectionSchema } from '@/lib/validation/collection';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FREE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

type Row = { id: string; priceAgorot: number | null; marketing: Record<string, unknown> };

function fakeDb(rows: Row[]) {
  const updates: Array<{ id: string; marketing: Record<string, unknown> }> = [];
  const db = {
    course: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        rows.filter((r) => where.id.in.includes(r.id)),
      update: async ({ where, data }: { where: { id: string }; data: { marketing: Record<string, unknown> } }) => {
        updates.push({ id: where.id, marketing: data.marketing });
        return {};
      },
    },
  } as unknown as Parameters<typeof syncCrossAddons>[0];
  return { db, updates };
}

describe('collection schema', () => {
  it('requires at least two courses', () => {
    expect(collectionSchema.safeParse({ title: 'x', courseIds: [A], content: {} }).success).toBe(false);
    expect(collectionSchema.safeParse({ title: 'x', courseIds: [A, B], content: {} }).success).toBe(true);
  });
});

describe('syncCrossAddons', () => {
  it('adds sibling priced courses as add-ons at their own price, skipping unpriced ones', async () => {
    const { db, updates } = fakeDb([
      { id: A, priceAgorot: 10000, marketing: {} },
      { id: B, priceAgorot: 20000, marketing: {} },
      { id: FREE, priceAgorot: null, marketing: {} },
    ]);
    await syncCrossAddons(db, [A, B, FREE]);
    const a = updates.find((u) => u.id === A)!.marketing.checkoutAddons;
    const b = updates.find((u) => u.id === B)!.marketing.checkoutAddons;
    expect(a).toEqual([{ courseId: B, priceAgorot: 20000 }]);
    expect(b).toEqual([{ courseId: A, priceAgorot: 10000 }]);
    expect(updates.find((u) => u.id === FREE)).toBeUndefined();
  });

  it('never touches existing add-ons or their prices, and skips bundled courses', async () => {
    const { db, updates } = fakeDb([
      {
        id: A,
        priceAgorot: 10000,
        marketing: { checkoutAddons: [{ courseId: B, priceAgorot: 5000 }], bundleCourseIds: [C] },
      },
      { id: B, priceAgorot: 20000, marketing: {} },
      { id: C, priceAgorot: 30000, marketing: {} },
    ]);
    await syncCrossAddons(db, [A, B, C]);
    const a = updates.find((u) => u.id === A);
    // B already there (discounted price kept), C is bundled → nothing to add for A.
    expect(a).toBeUndefined();
  });

  it('is a no-op when everything is already in place', async () => {
    const { db, updates } = fakeDb([
      { id: A, priceAgorot: 10000, marketing: { checkoutAddons: [{ courseId: B, priceAgorot: 20000 }] } },
      { id: B, priceAgorot: 20000, marketing: { checkoutAddons: [{ courseId: A, priceAgorot: 10000 }] } },
    ]);
    await syncCrossAddons(db, [A, B]);
    expect(updates).toHaveLength(0);
  });
});
