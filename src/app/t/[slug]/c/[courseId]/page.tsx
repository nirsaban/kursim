import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getAuth } from '@/lib/auth/guards';
import { parseMarketing } from '@/lib/validation/marketing';
import ClassicLanding from '@/components/landing/ClassicLanding';
import CoralHotaLanding from '@/components/landing/coralhota/CoralHotaLanding';
import { trackAffiliateVisit } from '@/lib/affiliates';
import { trackCourseLandingView } from '@/lib/analytics/page-views';
import { headers } from 'next/headers';
import { he } from '@/lib/he';
import { loadLanding } from './data';
import { buildLandingProps, deviceTypeFromUa } from '@/lib/landing/build-props';

type Params = {
  params: Promise<{ slug: string; courseId: string }>;
  searchParams: Promise<{ ref?: string }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, courseId } = await params;
  const data = await loadLanding(slug, courseId);
  if (!data) return {};
  const m = parseMarketing(data.course.marketing);
  const title = `${m.headline || data.course.title} · ${data.tenant.name}`;
  const description = m.subheadline || data.course.description || undefined;
  // og:* is set explicitly so the shared preview shows the course and school
  // without the platform suffix the document <title> template appends. The
  // image itself comes from opengraph-image.tsx in this segment.
  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title,
      description,
      siteName: data.tenant.name,
      locale: 'he_IL',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function CourseLandingPage({ params, searchParams }: Params) {
  const { slug, courseId } = await params;
  const data = await loadLanding(slug, courseId);
  if (!data) notFound();
  const { tenant, course } = data;
  const m = parseMarketing(course.marketing);

  const h = await headers();
  const ua = h.get('user-agent') ?? '';

  // The results carousel sizes its slides from this on the server — without it
  // the track renders empty until hydration.
  const deviceType = deviceTypeFromUa(ua);

  // Landing page + (if arriving via a share link) affiliate visit tracking.
  // Gated on landingPublished so staff previewing an unpublished page never
  // inflates either counter.
  const { ref } = await searchParams;
  if (course.landingPublished) {
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    await trackCourseLandingView(tenant.id, courseId, ip, ua).catch(() => {});
    if (ref) await trackAffiliateVisit(tenant.id, courseId, ref, ip, ua).catch(() => {});
  }

  // Unpublished pages are visible only to the tenant's staff as a preview.
  let previewMode = false;
  if (!course.landingPublished) {
    const auth = await getAuth();
    const isStaff =
      auth &&
      auth.tenantId === tenant.id &&
      (auth.role === 'OWNER' || auth.role === 'INSTRUCTOR');
    if (!isStaff) notFound();
    previewMode = true;
  }

  const landingProps = await buildLandingProps({
    slug,
    tenant,
    course,
    m,
    previewMode,
    deviceType,
  });

  if (m.layout === 'coralHota') {
    return <CoralHotaLanding {...landingProps} />;
  }
  return <ClassicLanding {...landingProps} />;
}
