import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getAuth } from '@/lib/auth/guards';
import { parseMarketing, saleActive } from '@/lib/validation/marketing';
import { LANDING_THEMES } from '@/lib/landing-themes';
import { isCloudinaryConfigured } from '@/lib/cloudinary/client';
import { signedDeliveryUrl, VIDEO_URL_TTL_SEC } from '@/lib/cloudinary/sign-delivery';
import ClassicLanding from '@/components/landing/ClassicLanding';
import CoralHotaLanding from '@/components/landing/coralhota/CoralHotaLanding';
import type { LandingProps } from '@/components/landing/landing-types';
import { trackAffiliateVisit } from '@/lib/affiliates';
import { headers } from 'next/headers';
import { he } from '@/lib/he';
import { loadLanding } from './data';

type Params = {
  params: Promise<{ slug: string; courseId: string }>;
  searchParams: Promise<{ ref?: string }>;
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, courseId } = await params;
  const data = await loadLanding(slug, courseId);
  if (!data) return {};
  const m = parseMarketing(data.course.marketing);
  return {
    title: `${m.headline || data.course.title} · ${data.tenant.name}`,
    description: m.subheadline || data.course.description || undefined,
  };
}

export default async function CourseLandingPage({ params, searchParams }: Params) {
  const { slug, courseId } = await params;
  const data = await loadLanding(slug, courseId);
  if (!data) notFound();
  const { tenant, course } = data;
  const m = parseMarketing(course.marketing);

  // Affiliate visit: ?ref={code} — count unique visitors per share link.
  const { ref } = await searchParams;
  if (ref && course.landingPublished) {
    const h = await headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const ua = h.get('user-agent') ?? '';
    await trackAffiliateVisit(tenant.id, courseId, ref, ip, ua).catch(() => {});
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

  const theme = LANDING_THEMES[m.accent];
  const headline = m.headline || course.title;
  // Payment link wins: the CTA leads straight to checkout when one is set.
  const ctaHref = m.paymentLink || m.ctaLink || `/t/${slug}/login`;
  const ctaText = m.ctaText || (m.paymentLink ? he.payNow : he.enrollNow);
  const ctaExternal = /^https?:\/\//.test(ctaHref);
  const lessonCount = course.modules.reduce((n, mod) => n + mod.lessons.length, 0);

  // Approved student reviews (collected at course completion)
  const reviews = await forTenant(tenant.id).courseReview.findMany({
    where: { courseId, approved: true },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });

  // Social proof: real enrollment count, shown once it's meaningful.
  const enrollCount = await forTenant(tenant.id).enrollment.count({ where: { courseId } });

  // Gallery: mint signed delivery URLs server-side (page is dynamic)
  const gallery = isCloudinaryConfigured()
    ? m.gallery.map((item) => ({
        ...item,
        url: signedDeliveryUrl(
          item.publicId,
          item.kind === 'VIDEO' ? 'video' : 'image',
          VIDEO_URL_TTL_SEC,
          item.kind === 'VIDEO' ? 'mp4' : 'jpg',
        ),
        afterUrl:
          item.kind === 'BEFORE_AFTER' && item.afterPublicId
            ? signedDeliveryUrl(item.afterPublicId, 'image', VIDEO_URL_TTL_SEC, 'jpg')
            : null,
      }))
    : [];
  const totalSec = course.modules
    .flatMap((mod) => mod.lessons)
    .reduce((n, l) => n + (l.durationSec ?? 0), 0);
  const totalHours = totalSec >= 3600 ? Math.round((totalSec / 3600) * 10) / 10 : null;

  const externalProps = ctaExternal
    ? { target: '_blank' as const, rel: 'noopener noreferrer' as const }
    : {};

  // Sale / bundle offer: shown only while active; the partner course is
  // loaded through the tenant-scoped client so cross-tenant ids resolve to null.
  const showSale = saleActive(m);
  const salePartner =
    showSale && m.sale.partnerCourseId
      ? await forTenant(tenant.id).course.findFirst({
          where: { id: m.sale.partnerCourseId },
          select: {
            id: true,
            title: true,
            description: true,
            coverPublicId: true,
            landingPublished: true,
          },
        })
      : null;
  const salePartnerCoverUrl =
    salePartner?.coverPublicId && isCloudinaryConfigured()
      ? signedDeliveryUrl(salePartner.coverPublicId, 'image', VIDEO_URL_TTL_SEC, 'jpg')
      : null;
  const saleHref = m.sale.paymentLink || ctaHref;
  const saleExternalProps = /^https?:\/\//.test(saleHref)
    ? { target: '_blank' as const, rel: 'noopener noreferrer' as const }
    : {};

  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((n, r) => n + r.rating, 0) / reviews.length) * 10) / 10
      : null;

  // AI-generated cinematic hero (Veo → scroll-scrubbed frame sequence), if ready.
  const media = await forTenant(tenant.id).courseMedia.findFirst({ where: { courseId } });
  const cinematic =
    media?.status === 'ready' && media.framesBaseUrl && media.posterUrl
      ? { framesBaseUrl: media.framesBaseUrl, frameCount: media.frameCount, posterUrl: media.posterUrl }
      : null;

  // Hero showcase media (design 1e): prefer a before/after pair, else the first
  // gallery item. Skipped when the cinematic AI hero already owns the top fold.
  const heroMedia = cinematic
    ? null
    : (gallery.find((g) => g.kind === 'BEFORE_AFTER' && g.afterUrl) ?? gallery[0] ?? null);
  const galleryRest = heroMedia ? gallery.filter((g) => g !== heroMedia) : gallery;

  // Owners sometimes put an arrow in their own CTA text — don't double it.
  const ctaHasArrow = /[←→⬅]/.test(ctaText);
  const cta = (extra = '') => (
    <a
      href={ctaHref}
      {...externalProps}
      className={`group inline-flex items-center justify-center gap-2.5 font-bold text-[17px] rounded-full px-9 py-4 text-card transition-transform hover:scale-[1.03] active:scale-[0.99] ${extra}`}
      style={{ background: theme.main }}
    >
      {m.paymentLink && <span aria-hidden>🔒</span>}
      {ctaText}
      {m.priceText && <span className="font-medium opacity-90">· {m.priceText}</span>}
      {!ctaHasArrow && (
        <span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-1">
          ←
        </span>
      )}
    </a>
  );

  // Trust bullets under the primary CTA — the quiet objection-killers.
  const trustBullets = [
    he.trustInstantAccess,
    he.trustLifetime,
    he.trustAnyDevice,
    ...(m.paymentLink ? [he.trustSecurePayment] : []),
  ];

  const landingProps: LandingProps = {
    slug,
    tenantName: tenant.name,
    sessionLimit: tenant.sessionLimit,
    modules: course.modules,
    m,
    theme,
    previewMode,
    headline,
    ctaHref,
    ctaText,
    ctaExternal,
    externalProps,
    cta,
    trustBullets,
    lessonCount,
    reviews,
    enrollCount,
    gallery,
    galleryRest,
    heroMedia,
    totalHours,
    avgRating,
    cinematic,
    showSale,
    salePartner,
    salePartnerCoverUrl,
    saleHref,
    saleExternalProps,
  };

  if (m.layout === 'coralHota') {
    return <CoralHotaLanding {...landingProps} />;
  }
  return <ClassicLanding {...landingProps} />;
}
