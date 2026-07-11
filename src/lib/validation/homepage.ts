import { z } from 'zod';
import { LANDING_ACCENTS } from './marketing';

/**
 * Owner-customizable content for the logged-in student home page,
 * stored in Tenant.homepage (Json). Mirrors the marketing-JSON pattern.
 */
export const homepageSchema = z.object({
  welcomeHeadline: z.string().max(120).default(''),
  aboutSchool: z.string().max(2000).default(''),
  announcements: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        body: z.string().max(1000).default(''),
        /** yyyy-mm-dd; empty = undated. */
        date: z
          .string()
          .max(10)
          .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'must be yyyy-mm-dd')
          .default(''),
      }),
    )
    .max(10)
    .default([]),
  showStats: z.boolean().default(true),
  showAchievements: z.boolean().default(true),
  showCatalog: z.boolean().default(true),
  /** Course pinned to the top of the catalog section. */
  featuredCourseId: z.string().uuid().or(z.literal('')).default(''),
  accent: z.enum(LANDING_ACCENTS).default('petrol'),
  emoji: z.string().max(8).default('🎓'),
});

export type TenantHomepage = z.infer<typeof homepageSchema>;

export const emptyHomepage: TenantHomepage = homepageSchema.parse({});

/** Safe parse for values coming back out of the Json column. */
export function parseHomepage(value: unknown): TenantHomepage {
  const parsed = homepageSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : emptyHomepage;
}
