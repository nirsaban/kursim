import { z } from 'zod';

/**
 * Content of a combined landing page (CourseCollection.content). The page is
 * the front course's own landing page (same layout/theme/copy) minus the
 * story + benefits sections, with a course picker so buyers see every course
 * and go to that course's own checkout.
 */
export const collectionContentSchema = z.object({
  headline: z.string().max(120).default(''),
  subheadline: z.string().max(300).default(''),
  ctaText: z.string().max(60).default(''),
  /** Whose landing page (design + copy) the combined page is built from. Must be one of courseIds; defaults to the first. */
  primaryCourseId: z.string().uuid().or(z.literal('')).default(''),
  /**
   * When on, every priced course in the collection offers the other priced
   * collection courses as opt-in add-ons at its checkout (written into each
   * course's marketing.checkoutAddons — the existing, server-priced mechanism).
   */
  crossAddons: z.boolean().default(true),
});

export type CollectionContent = z.infer<typeof collectionContentSchema>;

export const collectionSchema = z.object({
  title: z.string().min(1).max(120),
  courseIds: z.array(z.string().uuid()).min(2).max(8),
  content: collectionContentSchema,
});

export type CollectionInput = z.infer<typeof collectionSchema>;

export function parseCollectionContent(raw: unknown): CollectionContent {
  const r = collectionContentSchema.safeParse(raw ?? {});
  return r.success ? r.data : collectionContentSchema.parse({});
}
