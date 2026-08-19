import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og/card';
import { he } from '@/lib/he';

/**
 * The platform's default link preview. Metadata images cascade, so every page
 * that does not ship its own opengraph-image falls back to this one — and it
 * lives outside /t/, so a link-preview crawler can always reach it.
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = he.metaTitle;

export default async function Image() {
  return ogCard({ title: he.metaTitle, subtitle: he.metaDescription });
}
