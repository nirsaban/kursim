import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getAuth } from '@/lib/auth/guards';
import { parseMarketing } from '@/lib/validation/marketing';
import { parseSocials } from '@/lib/validation/links';
import { parseCollectionContent } from '@/lib/validation/collection';
import { LANDING_THEMES } from '@/lib/landing-themes';
import { resolveOffer } from '@/lib/pay/offer';
import { formatAgorot } from '@/lib/money';
import { signedDeliveryUrl, VIDEO_URL_TTL_SEC } from '@/lib/cloudinary/sign-delivery';
import { isCloudinaryConfigured } from '@/lib/cloudinary/client';
import { trackCollectionView } from '@/lib/analytics/page-views';
import CollectionLanding, { type CollectionCourseCard } from '@/components/landing/CollectionLanding';
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
 * Combined landing page: several courses, one link. Every card leads to that
 * course's own checkout — the collection never prices anything itself.
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
  if (!previewMode) {
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    await trackCollectionView(tenant.id, collectionId, ip, h.get('user-agent') ?? '').catch(() => {});
  }

  const content = parseCollectionContent(row.content);
  const theme = LANDING_THEMES[content.accent];

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
      modules: { select: { lessons: { select: { id: true, durationSec: true } } } },
    },
  });
  const byId = new Map(courses.map((c) => [c.id, c]));
  const ordered = row.courseIds.map((id) => byId.get(id)).filter(Boolean) as typeof courses;
  const siblingIds = new Set(ordered.map((c) => c.id));

  const cards: CollectionCourseCard[] = [];
  for (const course of ordered) {
    const m = parseMarketing(course.marketing);
    const forSale = Boolean(course.priceAgorot && course.priceAgorot > 0);
    const offer = forSale ? await resolveOffer(db, course) : null;
    const checkoutHref = `/t/${slug}/c/${course.id}/checkout`;
    // Priced → own checkout. Otherwise the legacy Grow link, else the course's
    // landing page (only if published), else nothing to sell.
    const ctaHref = forSale
      ? checkoutHref
      : m.paymentLink || (course.landingPublished ? `/t/${slug}/c/${course.id}` : null);
    const lessons = course.modules.flatMap((mod) => mod.lessons);
    const totalSec = lessons.reduce((s, l) => s + (l.durationSec ?? 0), 0);
    // "Add the other" links: only add-ons the course's own offer already allows
    // AND that are part of this collection.
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
      totalHours: Math.round((totalSec / 3600) * 10) / 10,
      priceLabel: m.priceText || (offer ? formatAgorot(offer.baseAgorot) : ''),
      strikeLabel: offer?.strikeAgorot ? formatAgorot(offer.strikeAgorot) : null,
      ctaHref,
      ctaText: content.ctaText || (forSale || m.paymentLink ? he.payNow : he.enrollNow),
      detailsHref: course.landingPublished ? `/t/${slug}/c/${course.id}` : null,
      addons: addable.map((a) => ({
        id: a.id,
        title: a.title,
        priceLabel: formatAgorot(a.priceAgorot),
        href: `${checkoutHref}?addon=${a.id}`,
      })),
    });
  }
  if (cards.length === 0) notFound();

  return (
    <CollectionLanding
      tenantName={tenant.name}
      content={content}
      theme={theme}
      cards={cards}
      socials={parseSocials(tenant.socials)}
      previewMode={previewMode}
    />
  );
}
