import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getAuth } from '@/lib/auth/guards';
import { parseMarketing } from '@/lib/validation/marketing';
import { parseCollectionContent } from '@/lib/validation/collection';
import { resolveOffer } from '@/lib/pay/offer';
import { formatAgorot } from '@/lib/money';
import { signedDeliveryUrl, VIDEO_URL_TTL_SEC } from '@/lib/cloudinary/sign-delivery';
import { isCloudinaryConfigured } from '@/lib/cloudinary/client';
import { trackCollectionView } from '@/lib/analytics/page-views';
import { buildLandingProps, deviceTypeFromUa } from '@/lib/landing/build-props';
import ClassicLanding from '@/components/landing/ClassicLanding';
import CoralHotaLanding from '@/components/landing/coralhota/CoralHotaLanding';
import type { LandingCollectionCourse } from '@/components/landing/landing-types';
import { he } from '@/lib/he';

type Params = { params: Promise<{ slug: string; collectionId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, collectionId } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return {};
  const row = await forTenant(tenant.id).courseCollection.findFirst({ where: { id: collectionId } });
  if (!row) return {};
  const c = parseCollectionContent(row.content);
  const title = `${c.headline || row.title} · ${tenant.name}`;
  const description = c.subheadline || undefined;
  return {
    title,
    description,
    openGraph: { type: 'website', title, description, siteName: tenant.name, locale: 'he_IL' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * Combined landing page: the front course's own landing page (same layout,
 * theme and copy) minus story + benefits, with lesson/hour totals merged
 * across every course and a course picker at #courses. Every buy button
 * leads to that course's own checkout — the collection never prices anything.
 */
export default async function CollectionPage({ params }: Params) {
  const { slug, collectionId } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status !== 'ACTIVE') notFound();

  const db = forTenant(tenant.id);
  const row = await db.courseCollection.findFirst({ where: { id: collectionId } });
  if (!row) notFound();

  let previewMode = false;
  if (!row.published) {
    const auth = await getAuth();
    const isStaff =
      auth && auth.tenantId === tenant.id && (auth.role === 'OWNER' || auth.role === 'INSTRUCTOR');
    if (!isStaff) notFound();
    previewMode = true;
  }

  const h = await headers();
  const ua = h.get('user-agent') ?? '';
  if (!previewMode) {
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    await trackCollectionView(tenant.id, collectionId, ip, ua).catch(() => {});
  }

  const content = parseCollectionContent(row.content);

  const courses = await db.course.findMany({
    where: { id: { in: row.courseIds } },
    select: {
      id: true,
      title: true,
      description: true,
      coverPublicId: true,
      priceAgorot: true,
      marketing: true,
      landingPublished: true,
      modules: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          title: true,
          lessons: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, title: true, durationSec: true },
          },
        },
      },
    },
  });
  const byId = new Map(courses.map((c) => [c.id, c]));
  const ordered = row.courseIds.map((id) => byId.get(id)).filter(Boolean) as typeof courses;
  if (ordered.length === 0) notFound();
  const front = byId.get(content.primaryCourseId) ?? ordered[0];
  const siblingIds = new Set(ordered.map((c) => c.id));

  // One card per course, each with its own checkout.
  const cards: LandingCollectionCourse[] = [];
  let minAgorot: number | null = null;
  let lessonCount = 0;
  let totalSec = 0;
  for (const course of ordered) {
    const m = parseMarketing(course.marketing);
    const forSale = Boolean(course.priceAgorot && course.priceAgorot > 0);
    const offer = forSale ? await resolveOffer(db, course) : null;
    if (offer) minAgorot = minAgorot === null ? offer.baseAgorot : Math.min(minAgorot, offer.baseAgorot);
    const checkoutHref = `/t/${slug}/c/${course.id}/checkout`;
    const ctaHref = forSale
      ? checkoutHref
      : m.paymentLink || (course.landingPublished ? `/t/${slug}/c/${course.id}` : null);
    const lessons = course.modules.flatMap((mod) => mod.lessons);
    const sec = lessons.reduce((s, l) => s + (l.durationSec ?? 0), 0);
    lessonCount += lessons.length;
    totalSec += sec;
    const addable = (offer?.addons ?? []).filter((a) => siblingIds.has(a.id));
    cards.push({
      id: course.id,
      title: m.headline || course.title,
      description: m.subheadline || course.description || '',
      emoji: m.emoji,
      coverUrl:
        course.coverPublicId && isCloudinaryConfigured()
          ? signedDeliveryUrl(course.coverPublicId, 'image', VIDEO_URL_TTL_SEC, 'jpg')
          : null,
      outcomes: m.outcomes.slice(0, 3),
      lessonCount: lessons.length,
      totalHours: sec >= 3600 ? Math.round((sec / 3600) * 10) / 10 : null,
      priceLabel: m.priceText || (offer ? formatAgorot(offer.baseAgorot) : ''),
      strikeLabel: offer?.strikeAgorot ? formatAgorot(offer.strikeAgorot) : null,
      ctaHref,
      ctaText: m.ctaText || (forSale || m.paymentLink ? he.payNow : he.enrollNow),
      detailsHref: course.landingPublished ? `/t/${slug}/c/${course.id}` : null,
      addons: addable.map((a) => ({
        id: a.id,
        title: a.title,
        priceLabel: formatAgorot(a.priceAgorot),
        href: `${checkoutHref}?addon=${a.id}`,
      })),
      isFront: course.id === front.id,
    });
  }

  // The front course's page, with the two long-form sections removed.
  const frontM = parseMarketing(front.marketing);
  const m = { ...frontM, story: [], benefits: [] };

  const landingProps = await buildLandingProps({
    slug,
    tenant,
    course: front,
    m,
    previewMode,
    deviceType: deviceTypeFromUa(ua),
    overrides: {
      headline: content.headline || undefined,
      ctaHref: '#courses',
      ctaText: content.ctaText || he.collectionChooseCourseCta,
      priceLabel: minAgorot !== null ? he.collectionPriceFrom.replace('{price}', formatAgorot(minAgorot)) : '',
      lessonCount,
      totalHours: totalSec >= 3600 ? Math.round((totalSec / 3600) * 10) / 10 : null,
      collection: {
        title: content.subheadline ? content.headline || he.collectionSectionTitle : he.collectionSectionTitle,
        subtitle: content.subheadline || he.collectionEachSeparate,
        courses: cards,
      },
    },
  });

  if (m.layout === 'coralHota') return <CoralHotaLanding {...landingProps} />;
  return <ClassicLanding {...landingProps} />;
}
