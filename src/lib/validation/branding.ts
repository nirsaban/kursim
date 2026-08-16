import { z } from 'zod';

/**
 * Tenant branding + terms-gate configs, both stored as JSON columns on Tenant
 * (same contract as homepage: schema-validated on write, parse-with-fallback
 * on read so a bad historical value can never crash a page).
 */

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex color like #2563eb');

export const brandingSchema = z.object({
  /** Small logo as a data URL — the studio downscales to ≤256px before saving. */
  logo: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/)
    .max(400_000)
    .nullable()
    .default(null),
  /** Rendered logo box size in px (navbar + login). */
  logoSize: z.number().int().min(24).max(64).default(36),
  /** Tenant accent color; null = the platform default look. */
  primary: hexColor.nullable().default(null),
});

export type Branding = z.infer<typeof brandingSchema>;

export function parseBranding(raw: unknown): Branding {
  const r = brandingSchema.safeParse(raw ?? {});
  return r.success ? r.data : brandingSchema.parse({});
}

/** Mix a hex color toward black — used for the darker stop of hero gradients. */
export function darkenHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * (1 - amount));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export const termsSchema = z.object({
  enabled: z.boolean().default(false),
  /** Bumping the version re-prompts every student who accepted an older one. */
  version: z.number().int().min(1).max(10_000).default(1),
  title: z.string().max(200).default(''),
  body: z.string().max(20_000).default(''),
  /** Optional link to the full document hosted elsewhere. */
  url: z.string().url().max(500).or(z.literal('')).default(''),
});

export type Terms = z.infer<typeof termsSchema>;

export function parseTerms(raw: unknown): Terms {
  const r = termsSchema.safeParse(raw ?? {});
  return r.success ? r.data : termsSchema.parse({});
}

/** True when this user must (re-)accept the tenant's terms before the student UI. */
export function termsGateBlocks(
  terms: Terms,
  user: { acceptedTermsAt: Date | null; acceptedTermsVersion: number },
): boolean {
  if (!terms.enabled) return false;
  return !user.acceptedTermsAt || user.acceptedTermsVersion < terms.version;
}
