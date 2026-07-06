import { z } from 'zod';

/** Landing-page accent themes the owner can pick in the onboarding wizard. */
export const LANDING_ACCENTS = ['petrol', 'copper', 'plum', 'forest', 'midnight'] as const;
export type LandingAccent = (typeof LANDING_ACCENTS)[number];

export const marketingSchema = z.object({
  headline: z.string().max(120).default(''),
  subheadline: z.string().max(300).default(''),
  aboutSchool: z.string().max(2000).default(''),
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
  /** Checkout/payment URL — when set, the landing CTA opens it. */
  paymentLink: z
    .string()
    .max(500)
    .refine((v) => v === '' || /^https?:\/\//.test(v), 'must be an http(s) URL')
    .default(''),
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
  contactPhone: z.string().max(30).default(''),
  contactEmail: z.string().max(320).default(''),
  accent: z.enum(LANDING_ACCENTS).default('petrol'),
  emoji: z.string().max(8).default('🎓'),
});

export type CourseMarketing = z.infer<typeof marketingSchema>;

export const emptyMarketing: CourseMarketing = marketingSchema.parse({});

/** Safe parse for values coming back out of the Json column. */
export function parseMarketing(value: unknown): CourseMarketing {
  const parsed = marketingSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : emptyMarketing;
}
