import type { ReactNode } from 'react';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseSocials } from '@/lib/validation/links';
import { saleActive, type CourseMarketing } from '@/lib/validation/marketing';
import { LANDING_THEMES } from '@/lib/landing-themes';
import { resolveOffer } from '@/lib/pay/offer';
import { formatAgorot } from '@/lib/money';
import { signedDeliveryUrl, VIDEO_URL_TTL_SEC } from '@/lib/cloudinary/sign-delivery';
import { isCloudinaryConfigured } from '@/lib/cloudinary/client';
import type { LandingCollection, LandingModule, LandingProps } from '@/components/landing/landing-types';
import { he } from '@/lib/he';

export interface LandingCourse {
  id: string;
  title: string;
  priceAgorot: number | null;
  marketing: unknown;
  modules: LandingModule[];
}

export interface LandingTenant {
  id: string;
  name: string;
  sessionLimit: number;
  socials: unknown;
}

/**
 * Optional overrides used by combined (multi-course) landing pages, which
 * render the front course's page but point the CTA at the course picker and
 * merge lesson/hour totals across every course on the page.
 */
export interface LandingOverrides {
  headline?: string;
  ctaHref?: string;
  ctaText?: string;
  priceLabel?: string;
  lessonCount?: number;
  totalHours?: number | null;
  collection?: LandingCollection;
}

/** Coarse device class from the request UA — lets the carousel size slides during SSR. */
export function deviceTypeFromUa(ua: string): 'mobile' | 'tablet' | 'desktop' {
  return /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone|iPod/i.test(ua) ? 'mobile' : 'desktop';
}

/**
 * Everything a landing template needs, computed once for both the single-course
 * page and the combined page — so the two can never drift in how they price,
 * sign media, or pick the hero.
 */
export async function buildLandingProps(args: {
  slug: string;
  tenant: LandingTenant;
  course: LandingCourse;
  m: CourseMarketing;
  previewMode: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  overrides?: LandingOverrides;
}): Promise<LandingProps> {
  const { slug, tenant, course, m, previewMode, deviceType, overrides = {} } = args;
  const courseId = course.id;

  const theme = LANDING_THEMES[m.accent];
  const headline = overrides.headline || m.headline || course.title;
  // A priced course sells through our own checkout (Hyp). Falling back to the
  // legacy Grow link keeps pages configured before the switch selling as they
  // did — a landing page must never lose its buy button on deploy.
  const forSale = Boolean(course.priceAgorot && course.priceAgorot > 0);
  const checkoutHref = `/t/${slug}/c/${courseId}/checkout`;
  const ctaHref =
    overrides.ctaHref ?? (forSale ? checkoutHref : m.paymentLink || m.ctaLink || `/t/${slug}/login`);
  const ctaText =
    overrides.ctaText ?? (m.ctaText || (forSale || m.paymentLink ? he.payNow : he.enrollNow));
  const ctaExternal = /^https?:\/\//.test(ctaHref);
  const paid = forSale || Boolean(m.paymentLink);
  // What the buy button will actually charge — the bundle price when the seller
  // set one, so the landing page can't advertise a number the checkout won't
  // honour. Optional add-ons aren't counted: nobody has ticked one yet.
  const offer = forSale ? await resolveOffer(forTenant(tenant.id), course) : null;
  // Owner-written price wording still wins — it may say "2 payments of ₪175".
  const priceLabel = overrides.priceLabel ?? (m.priceText || (offer ? formatAgorot(offer.baseAgorot) : ''));
  const lessonCount =
    overrides.lessonCount ?? course.modules.reduce((n, mod) => n + mod.lessons.length, 0);

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
  // Results wall: same signed-delivery treatment as the gallery.
  const results = isCloudinaryConfigured()
    ? m.results.map((item) => ({
        url: signedDeliveryUrl(item.publicId, 'image', VIDEO_URL_TTL_SEC, 'jpg'),
        caption: item.caption,
      }))
    : [];
  const totalSec = course.modules
    .flatMap((mod) => mod.lessons)
    .reduce((n, l) => n + (l.durationSec ?? 0), 0);
  const totalHours =
    overrides.totalHours !== undefined
      ? overrides.totalHours
      : totalSec >= 3600
        ? Math.round((totalSec / 3600) * 10) / 10
        : null;

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
  const cta = (extra = ''): ReactNode => (
    <a
      href={ctaHref}
      {...externalProps}
      className={`group inline-flex items-center justify-center gap-2.5 font-bold text-[17px] rounded-lg px-9 py-4 text-card transition-opacity hover:opacity-90 ${extra}`}
      style={{ background: theme.main }}
    >
      {paid && <span aria-hidden>🔒</span>}
      {ctaText}
      {priceLabel && <span className="font-medium opacity-90">· {priceLabel}</span>}
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
    ...(paid ? [he.trustSecurePayment] : []),
  ];

  return {
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
    paid,
    priceLabel,
    externalProps,
    cta,
    trustBullets,
    lessonCount,
    reviews,
    enrollCount,
    gallery,
    galleryRest,
    results,
    deviceType,
    heroMedia,
    totalHours,
    avgRating,
    cinematic,
    showSale,
    salePartner,
    salePartnerCoverUrl,
    saleHref,
    saleExternalProps,
    socials: parseSocials(tenant.socials),
    collection: overrides.collection ?? null,
  };

}
