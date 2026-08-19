/**
 * The one place the platform's own identity lives. Tenant-facing copy stays in
 * he.ts; this is the brand itself — name, mark colors, social-preview defaults —
 * so a future rename is a single edit rather than a repo-wide search.
 */
export const BRAND = {
  name: 'GeniriSchool',
  /** Latin domain-style handle used in synthesised emails and asset paths. */
  slug: 'genirischool',
  tagline: 'בית הספר הדיגיטלי שלכם',
  /** Copper — the single accent of the «דיו ואות» palette. */
  accent: '#E4572E',
  ink: '#12151D',
  inkSoft: '#232836',
  paper: '#F5F2EB',
} as const;
