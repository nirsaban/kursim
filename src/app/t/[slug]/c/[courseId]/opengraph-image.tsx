import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/og/card';
import { parseMarketing } from '@/lib/validation/marketing';
import { parseBranding } from '@/lib/validation/branding';
import { LANDING_THEMES } from '@/lib/landing-themes';
import { he } from '@/lib/he';
import { loadLanding } from './data';

/**
 * The preview WhatsApp shows when someone shares a course landing page: the
 * course's own headline, the school's name and logo, in the landing theme's
 * accent. Unpublished pages fall back to the neutral platform card — this URL
 * is public, and a draft must not leak through it any more than through the
 * page itself, which 404s for everyone but the school's staff.
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = he.metaTitle;

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const data = await loadLanding(slug, courseId);

  if (!data || !data.course.landingPublished) {
    return ogCard({ title: he.metaTitle, subtitle: he.metaDescription });
  }

  const { tenant, course } = data;
  const m = parseMarketing(course.marketing);
  return ogCard({
    title: m.headline || course.title,
    subtitle: m.subheadline || course.description,
    eyebrow: tenant.name,
    logo: parseBranding(tenant.branding).logo,
    accent: LANDING_THEMES[m.accent]?.main,
  });
}
