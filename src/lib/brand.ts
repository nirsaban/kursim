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
  /** Purple — the single accent of the Udemy-style palette. */
  accent: '#6D28D2',
  ink: '#303141',
  inkSoft: '#1D1E27',
  paper: '#FFFFFF',
} as const;
