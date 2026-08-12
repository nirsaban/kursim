import { z } from 'zod';

/** Landing-page accent themes the owner can pick in the onboarding wizard. */
export const LANDING_ACCENTS = [
  'petrol',
  'copper',
  'plum',
  'forest',
  'midnight',
  'royal',
  'rose',
  'ocean',
  'sunset',
  'noir',
] as const;
export type LandingAccent = (typeof LANDING_ACCENTS)[number];

/** Landing-page visual templates the owner can pick, independent of accent color. */
export const LANDING_LAYOUTS = ['classic', 'coralHota'] as const;
export type LandingLayout = (typeof LANDING_LAYOUTS)[number];

export const marketingSchema = z.object({
  headline: z.string().max(120).default(''),
  subheadline: z.string().max(300).default(''),
  aboutSchool: z.string().max(2000).default(''),
  /**
   * Long-form copy split into its own titled sections on the landing page, for
   * owners whose story doesn't fit one prose block. Rendered after the intro;
   * entries with an empty body are skipped.
   */
  story: z
    .array(
      z.object({
        title: z.string().max(120).default(''),
        body: z.string().max(2000).default(''),
      }),
    )
    .max(6)
    .default([]),
  instructorName: z.string().max(100).default(''),
  audience: z.array(z.string().min(1).max(200)).max(6).default([]),
  outcomes: z.array(z.string().min(1).max(200)).max(8).default([]),
  benefits: z
    .array(z.object({ title: z.string().min(1).max(100), body: z.string().max(300).default('') }))
    .max(6)
    .default([]),
  testimonials: z
    .array(z.object({ name: z.string().min(1).max(100), quote: z.string().min(1).max(500) }))
    .max(6)
    .default([]),
  faq: z
    .array(z.object({ q: z.string().min(1).max(200), a: z.string().min(1).max(1000) }))
    .max(10)
    .default([]),
  priceText: z.string().max(100).default(''),
  ctaText: z.string().max(60).default(''),
  ctaLink: z.string().max(500).default(''),
  /**
   * Legacy Grow checkout URL. Superseded by `Course.priceAgorot` + Hyp
   * checkout, and no longer editable in the admin — kept so landing pages
   * configured before the switch keep their working buy button.
   */
  paymentLink: z
    .string()
    .max(500)
    .refine((v) => v === '' || /^https?:\/\//.test(v), 'must be an http(s) URL')
    .default(''),
  /**
   * Other courses of the same tenant that buying THIS one also unlocks — the
   * "1+1" bundle, replacing Grow's `c=id1,id2` callback trick. The price stays
   * this course's `priceAgorot`; the extras ride along for free.
   *
   * Read server-side only when starting a checkout, never from the browser, so
   * a crafted request can't add courses to an order.
   */
  bundleCourseIds: z.array(z.string().uuid()).max(5).default([]),
  /**
   * One price for the whole bundle, in agorot, instead of this course's own
   * `priceAgorot` — "both courses for ₪349" as a number the seller sets rather
   * than arithmetic nobody can audit. Only used when `bundleCourseIds` isn't
   * empty; null keeps the older behaviour where the extras ride along free at
   * the primary course's price.
   */
  bundlePriceAgorot: z.number().int().positive().max(10_000_000).nullable().default(null),
  /**
   * Extras the BUYER may tick at checkout, each for its own added charge —
   * the opt-in half of the bundle story ("add course B for +₪199").
   *
   * The browser sends only which extras were ticked; what each one costs is
   * read from here, server-side, so a crafted request can raise the order's
   * contents but never lower its price.
   */
  checkoutAddons: z
    .array(
      z.object({
        courseId: z.string().uuid(),
        priceAgorot: z.number().int().positive().max(10_000_000),
      }),
    )
    .max(3)
    .default([]),
  /**
   * Photos, short clips, and before/after pairs shown in the landing gallery.
   * BEFORE_AFTER uses publicId as the "before" image and afterPublicId as the "after".
   */
  gallery: z
    .array(
      z.object({
        publicId: z.string().min(1).max(512),
        kind: z.enum(['IMAGE', 'VIDEO', 'BEFORE_AFTER']),
        afterPublicId: z.string().max(512).default(''),
        caption: z.string().max(200).default(''),
      }),
    )
    .max(8)
    .default([]),
  /**
   * Proof shots — photos of what students actually produced, shown as their own
   * masonry section. Kept separate from `gallery`, whose first item doubles as
   * the intro/curriculum image in some layouts.
   */
  results: z
    .array(
      z.object({
        publicId: z.string().min(1).max(512),
        caption: z.string().max(200).default(''),
      }),
    )
    .max(12)
    .default([]),
  /**
   * Optional sale/bundle offer (e.g. 1+1 or a discount on a second course).
   * Free-text wording keeps it flexible; partnerCourseId features another
   * course of the same tenant inside the deal section.
   */
  sale: z
    .object({
      enabled: z.boolean().default(false),
      title: z.string().max(120).default(''),
      description: z.string().max(1000).default(''),
      partnerCourseId: z.string().uuid().or(z.literal('')).default(''),
      paymentLink: z
        .string()
        .max(500)
        .refine((v) => v === '' || /^https?:\/\//.test(v), 'must be an http(s) URL')
        .default(''),
      /** yyyy-mm-dd; empty = no expiry. The sale hides itself after this day. */
      endsAt: z
        .string()
        .max(10)
        .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'must be yyyy-mm-dd')
        .default(''),
    })
    .default({}),
  contactPhone: z.string().max(30).default(''),
  contactEmail: z.string().max(320).default(''),
  accent: z.enum(LANDING_ACCENTS).default('petrol'),
  emoji: z.string().max(8).default('🎓'),
  layout: z.enum(LANDING_LAYOUTS).default('classic'),
});

export type CourseMarketing = z.infer<typeof marketingSchema>;

export const emptyMarketing: CourseMarketing = marketingSchema.parse({});

/** Safe parse for values coming back out of the Json column. */
export function parseMarketing(value: unknown): CourseMarketing {
  const parsed = marketingSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : emptyMarketing;
}

/** Whether the sale should currently show on the landing page (endsAt is inclusive). */
export function saleActive(m: CourseMarketing, now: Date = new Date()): boolean {
  const s = m.sale;
  if (!s.enabled || !s.title) return false;
  if (s.endsAt && now > new Date(`${s.endsAt}T23:59:59`)) return false;
  return true;
}
