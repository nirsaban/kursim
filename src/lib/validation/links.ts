import { z } from 'zod';
import { LANDING_ACCENTS } from '@/lib/validation/marketing';

/**
 * School-wide social links + the LinkTree page, both stored as JSON columns
 * on Tenant (same contract as homepage/branding: schema-validated on write,
 * parse-with-fallback on read so a bad historical value can never crash a page).
 */

const httpUrl = z.string().url().max(500).startsWith('http').or(z.literal('')).default('');

export const socialsSchema = z.object({
  /** WhatsApp phone in any local/intl form — normalized to wa.me digits on render. */
  whatsapp: z
    .string()
    .max(30)
    .regex(/^[\d\s+\-()]*$/, 'digits only')
    .default(''),
  instagram: httpUrl,
  facebook: httpUrl,
  tiktok: httpUrl,
  youtube: httpUrl,
  linkedin: httpUrl,
  website: httpUrl,
  email: z.string().email().max(200).or(z.literal('')).default(''),
});

export type Socials = z.infer<typeof socialsSchema>;

export function parseSocials(raw: unknown): Socials {
  const r = socialsSchema.safeParse(raw ?? {});
  return r.success ? r.data : socialsSchema.parse({});
}

/** True when at least one social channel is filled in. */
export function hasSocials(s: Socials): boolean {
  return Object.values(s).some((v) => v !== '');
}

/**
 * Normalise an Israeli/intl phone to wa.me digits. Pure re-implementation of
 * lib/whatsapp.ts#normalizeIlPhone — that module pulls in the Baileys session
 * stack and can't be imported from client components.
 */
export function waDigits(raw: string): string | null {
  let d = (raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('972')) {
    // ok
  } else if (d.startsWith('0')) {
    d = '972' + d.slice(1);
  } else if (d.length === 9) {
    d = '972' + d;
  } else if (d.length >= 11 && d.length <= 15) {
    // already an international number from elsewhere
  } else {
    return null;
  }
  return d.length >= 11 && d.length <= 15 ? d : null;
}

/** The ordered social entries that actually render, with their hrefs. */
export function socialEntries(s: Socials): Array<{ kind: keyof Socials; href: string }> {
  const wa = waDigits(s.whatsapp);
  const out: Array<{ kind: keyof Socials; href: string }> = [];
  if (wa) out.push({ kind: 'whatsapp', href: `https://wa.me/${wa}` });
  for (const kind of ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'website'] as const) {
    if (s[kind]) out.push({ kind, href: s[kind] });
  }
  if (s.email) out.push({ kind: 'email', href: `mailto:${s.email}` });
  return out;
}

export const LINKTREE_BUTTON_STYLES = ['solid', 'outline', 'soft'] as const;
export type LinktreeButtonStyle = (typeof LINKTREE_BUTTON_STYLES)[number];

const linktreeLinkSchema = z.object({
  label: z.string().min(1).max(80),
  url: httpUrl.refine((v) => v !== '', 'url required'),
  /** Optional leading emoji for the button. */
  emoji: z.string().max(8).default(''),
});

export type LinktreeLink = z.infer<typeof linktreeLinkSchema>;

export const linktreeSchema = z.object({
  published: z.boolean().default(false),
  /** Big line under the logo; empty = the school name. */
  headline: z.string().max(120).default(''),
  bio: z.string().max(400).default(''),
  /** Visual theme — reuses the landing-page accent palettes. */
  accent: z.enum(LANDING_ACCENTS).default('noir'),
  buttonStyle: z.enum(LINKTREE_BUTTON_STYLES).default('solid'),
  links: z.array(linktreeLinkSchema).max(30).default([]),
});

export type Linktree = z.infer<typeof linktreeSchema>;

export function parseLinktree(raw: unknown): Linktree {
  const r = linktreeSchema.safeParse(raw ?? {});
  return r.success ? r.data : linktreeSchema.parse({});
}
