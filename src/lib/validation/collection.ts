import { z } from 'zod';
import { LANDING_ACCENTS } from '@/lib/validation/marketing';

/**
 * Content of a combined landing page (CourseCollection.content). Deliberately
 * compact: a hero + one card per course. No story/benefits sections — the
 * page's job is to make "this school sells several courses" obvious and route
 * each buyer to the right course's own checkout.
 */
export const collectionContentSchema = z.object({
  headline: z.string().max(120).default(''),
  subheadline: z.string().max(300).default(''),
  intro: z.string().max(1500).default(''),
  ctaText: z.string().max(60).default(''),
  accent: z.enum(LANDING_ACCENTS).default('petrol'),
  emoji: z.string().max(8).default('🎓'),
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
