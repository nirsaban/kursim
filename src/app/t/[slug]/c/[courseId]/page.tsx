import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getAuth } from '@/lib/auth/guards';
import { parseMarketing, saleActive } from '@/lib/validation/marketing';
import { LANDING_THEMES } from '@/lib/landing-themes';
import { isCloudinaryConfigured } from '@/lib/cloudinary/client';
import { signedDeliveryUrl, VIDEO_URL_TTL_SEC } from '@/lib/cloudinary/sign-delivery';
import Reveal from '@/components/landing/Reveal';
import BeforeAfterSlider from '@/components/landing/BeforeAfterSlider';
import { trackAffiliateVisit } from '@/lib/affiliates';
import { headers } from 'next/headers';
import { he } from '@/lib/he';

type Params = {
  params: Promise<{ slug: string; courseId: string }>;
  searchParams: Promise<{ ref?: string }>;
};

async function loadLanding(slug: string, courseId: string) {
  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status !== 'ACTIVE') return null;
  const course = await forTenant(tenant.id).course.findFirst({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { sortOrder: 'asc' },
        include: { lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, durationSec: true } } },
      },
    },
  });
  if (!course) return null;
  return { tenant, course };
}

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
    ? { target: '_blank' as const, rel: 'noopener noreferrer' }
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
    ? { target: '_blank' as const, rel: 'noopener noreferrer' }
    : {};

  const cta = (extra = '') => (
    <a
      href={ctaHref}
      {...externalProps}
      className={`inline-flex items-center justify-center gap-2 font-display font-bold rounded-xl px-7 py-3.5 text-white transition-transform hover:scale-[1.02] active:scale-[0.99] ${extra}`}
      style={{ background: theme.accent }}
    >
      {m.paymentLink && <span aria-hidden>🔒</span>}
      {ctaText}
      {m.priceText && <span className="font-body font-medium opacity-90">· {m.priceText}</span>}
    </a>
  );

  return (
    <main className="bg-white text-ink">
      {previewMode && (
        <div className="bg-warn text-white text-center text-sm font-semibold py-2 px-4">
          {he.landingPreview} — {he.landingDraftBadge}
        </div>
      )}

      {/* Sale announcement strip */}
      {showSale && (
        <a
          href="#sale"
          className="block text-center text-sm font-bold text-white py-2.5 px-4 hover:opacity-95"
          style={{ background: theme.accent }}
        >
          🎁 {m.sale.title} — <span className="underline">{he.saleCta}</span>
        </a>
      )}

      {/* Mini nav */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur bg-white/85"
        style={{ borderColor: `${theme.main}22` }}
      >
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl" aria-hidden>
              {m.emoji}
            </span>
            <span className="font-display font-bold truncate">{tenant.name}</span>
          </div>
          <nav className="hidden sm:flex items-center gap-5 text-sm font-medium text-muted">
            {lessonCount > 0 && (
              <a href="#curriculum" className="hover:text-ink">
                {he.curriculum}
              </a>
            )}
            {m.testimonials.length > 0 && (
              <a href="#testimonials" className="hover:text-ink">
                {he.testimonialsTitle}
              </a>
            )}
            {gallery.length > 0 && (
              <a href="#gallery" className="hover:text-ink">
                {he.galleryTitle}
              </a>
            )}
            {reviews.length > 0 && (
              <a href="#reviews" className="hover:text-ink">
                {he.reviews}
              </a>
            )}
            {m.faq.length > 0 && (
              <a href="#faq" className="hover:text-ink">
                {he.faqTitle}
              </a>
            )}
            {showSale && (
              <a href="#sale" className="font-bold" style={{ color: theme.accent }}>
                {he.saleBadge}
              </a>
            )}
          </nav>
          <a
            href={ctaHref}
            {...externalProps}
            className="shrink-0 text-sm font-bold text-white rounded-lg px-4 py-2 transition-opacity hover:opacity-90"
            style={{ background: theme.accent }}
          >
            {ctaText}
          </a>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden text-white"
        style={{ background: `linear-gradient(140deg, ${theme.deep} 0%, ${theme.main} 100%)` }}
      >
        <div
          className="absolute inset-0 opacity-[0.12]"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-4 py-20 sm:py-28">
          <Reveal>
            <p className="font-semibold text-white/70 mb-4">{tenant.name}</p>
            <h1 className="font-display text-4xl sm:text-6xl font-bold leading-[1.1] max-w-3xl">
              {headline}
            </h1>
            {m.subheadline && (
              <p className="text-lg sm:text-xl text-white/80 mt-6 max-w-2xl leading-relaxed">
                {m.subheadline}
              </p>
            )}
          </Reveal>
          <Reveal delay={150}>
            <div className="flex flex-wrap items-center gap-4 mt-9">
              {cta()}
              <div className="flex flex-wrap gap-2 text-sm">
                {course.modules.length > 0 && (
                  <span className="bg-white/15 rounded-full px-3.5 py-1.5">
                    {course.modules.length} {he.modules}
                  </span>
                )}
                {lessonCount > 0 && (
                  <span className="bg-white/15 rounded-full px-3.5 py-1.5">
                    {lessonCount} {he.lessons}
                  </span>
                )}
                {totalHours && (
                  <span className="bg-white/15 rounded-full px-3.5 py-1.5" dir="ltr">
                    ~{totalHours} שעות
                  </span>
                )}
                {m.instructorName && (
                  <span className="bg-white/15 rounded-full px-3.5 py-1.5">
                    עם {m.instructorName}
                  </span>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Audience */}
      {m.audience.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-16">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-8">
              {he.audienceTitle}
            </h2>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {m.audience.map((a, i) => (
              <Reveal key={i} delay={i * 80}>
                <div
                  className="rounded-xl2 border p-5 h-full font-medium leading-relaxed"
                  style={{ borderColor: `${theme.main}33`, background: theme.soft }}
                >
                  {a}
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Outcomes */}
      {m.outcomes.length > 0 && (
        <section style={{ background: theme.soft }}>
          <div className="max-w-5xl mx-auto px-4 py-16">
            <Reveal>
              <h2 className="font-display text-2xl sm:text-3xl font-bold mb-8">
                {he.outcomesTitle}
              </h2>
            </Reveal>
            <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
              {m.outcomes.map((o, i) => (
                <Reveal key={i} delay={i * 60}>
                  <li className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-6 h-6 rounded-full text-white text-xs flex items-center justify-center shrink-0"
                      style={{ background: theme.main }}
                      aria-hidden
                    >
                      ✓
                    </span>
                    <span className="leading-relaxed">{o}</span>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Benefits */}
      {m.benefits.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-16">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-8">
              {he.benefitsTitle}
            </h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {m.benefits.map((b, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="border border-line rounded-xl2 p-6 h-full shadow-card">
                  <span
                    className="inline-flex w-10 h-10 rounded-xl text-white items-center justify-center font-display font-bold"
                    style={{ background: theme.main }}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <h3 className="font-display font-bold text-lg mt-4">{b.title}</h3>
                  {b.body && <p className="text-muted mt-2 leading-relaxed">{b.body}</p>}
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Gallery: photos, short clips, before/after results */}
      {gallery.length > 0 && (
        <section id="gallery" className="max-w-5xl mx-auto px-4 py-16">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-8">
              {he.galleryTitle}
            </h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2">
            {gallery.map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <figure>
                  {item.kind === 'VIDEO' ? (
                    <video
                      src={item.url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full aspect-[4/3] object-cover rounded-xl2 bg-ink/5 shadow-card"
                    />
                  ) : item.kind === 'BEFORE_AFTER' && item.afterUrl ? (
                    <BeforeAfterSlider
                      beforeUrl={item.url}
                      afterUrl={item.afterUrl}
                      beforeLabel={he.beforeLabel}
                      afterLabel={he.afterLabel}
                      accent={theme.accent}
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.url}
                      alt={item.caption || he.galleryTitle}
                      loading="lazy"
                      className="w-full aspect-[4/3] object-cover rounded-xl2 bg-ink/5 shadow-card"
                    />
                  )}
                  {item.caption && (
                    <figcaption className="text-sm text-muted mt-2 px-1">
                      {item.caption}
                    </figcaption>
                  )}
                </figure>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Curriculum */}
      {lessonCount > 0 && (
        <section id="curriculum" style={{ background: theme.soft }}>
          <div className="max-w-3xl mx-auto px-4 py-16">
            <Reveal>
              <h2 className="font-display text-2xl sm:text-3xl font-bold mb-8">
                {he.curriculum}
              </h2>
            </Reveal>
            <div className="space-y-3">
              {course.modules.map((mod, mi) => (
                <Reveal key={mod.id} delay={mi * 60}>
                  <details
                    className="group bg-white border border-line rounded-xl2 shadow-card overflow-hidden"
                    open={mi === 0}
                  >
                    <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                      <span
                        className="w-8 h-8 rounded-lg text-white font-display font-bold text-sm flex items-center justify-center shrink-0"
                        style={{ background: theme.main }}
                      >
                        {mi + 1}
                      </span>
                      <span className="font-display font-bold flex-1">{mod.title}</span>
                      <span className="text-xs text-muted">{mod.lessons.length} {he.lessons}</span>
                      <span
                        className="text-muted transition-transform group-open:rotate-180"
                        aria-hidden
                      >
                        ▾
                      </span>
                    </summary>
                    <ul className="border-t border-line/70 px-5 py-3 space-y-2">
                      {mod.lessons.map((l) => (
                        <li key={l.id} className="flex items-center gap-2.5 text-sm text-muted">
                          <span aria-hidden>▸</span>
                          <span className="flex-1">{l.title}</span>
                          {l.durationSec ? (
                            <span className="text-xs tabular-nums" dir="ltr">
                              {Math.floor(l.durationSec / 60)}:
                              {String(l.durationSec % 60).padStart(2, '0')}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {m.testimonials.length > 0 && (
        <section id="testimonials" className="max-w-5xl mx-auto px-4 py-16">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-8">
              {he.testimonialsTitle}
            </h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2">
            {m.testimonials.map((t, i) => (
              <Reveal key={i} delay={i * 80}>
                <figure
                  className="rounded-xl2 p-6 h-full border"
                  style={{ background: theme.soft, borderColor: `${theme.main}26` }}
                >
                  <blockquote className="leading-relaxed">
                    <span
                      className="font-display text-4xl leading-none block mb-2"
                      style={{ color: theme.main }}
                      aria-hidden
                    >
                      ”
                    </span>
                    {t.quote}
                  </blockquote>
                  <figcaption className="flex items-center gap-2.5 mt-4">
                    <span
                      className="w-9 h-9 rounded-full text-white font-display font-bold text-sm flex items-center justify-center"
                      style={{ background: theme.main }}
                      aria-hidden
                    >
                      {t.name[0]}
                    </span>
                    <span className="font-semibold text-sm">{t.name}</span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Verified student reviews (collected at course completion) */}
      {reviews.length > 0 && (
        <section id="reviews" className="max-w-5xl mx-auto px-4 py-16">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-2">
              {he.reviewsTitle}
            </h2>
            <p className="text-muted mb-8">{he.verifiedStudent} ✓</p>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r, i) => (
              <Reveal key={r.id} delay={i * 70}>
                <figure className="border border-line rounded-xl2 p-5 h-full shadow-card bg-white">
                  <div className="text-warn text-lg" aria-label={`${r.rating}/5`}>
                    {'★'.repeat(r.rating)}
                    <span className="text-line">{'★'.repeat(5 - r.rating)}</span>
                  </div>
                  <blockquote className="mt-3 leading-relaxed text-sm">{r.text}</blockquote>
                  <figcaption className="flex items-center gap-2 mt-4 text-sm">
                    <span className="font-semibold">{r.name || he.verifiedStudent}</span>
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 text-white"
                      style={{ background: theme.main }}
                    >
                      ✓ {he.verifiedStudent}
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      {(m.aboutSchool || m.instructorName) && (
        <section className="max-w-3xl mx-auto px-4 py-16">
          <Reveal>
            <div className="flex items-start gap-5">
              <span
                className="w-14 h-14 rounded-2xl text-3xl flex items-center justify-center shrink-0"
                style={{ background: theme.soft }}
                aria-hidden
              >
                {m.emoji}
              </span>
              <div>
                <h2 className="font-display text-2xl font-bold">
                  {m.instructorName ? `${he.aboutSchool} — ${m.instructorName}` : he.aboutSchool}
                </h2>
                {m.aboutSchool && (
                  <p className="text-muted mt-3 leading-relaxed whitespace-pre-wrap">
                    {m.aboutSchool}
                  </p>
                )}
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* FAQ */}
      {m.faq.length > 0 && (
        <section id="faq" style={{ background: theme.soft }}>
          <div className="max-w-3xl mx-auto px-4 py-16">
            <Reveal>
              <h2 className="font-display text-2xl sm:text-3xl font-bold mb-8">{he.faqTitle}</h2>
            </Reveal>
            <div className="space-y-3">
              {m.faq.map((f, i) => (
                <Reveal key={i} delay={i * 50}>
                  <details className="group bg-white border border-line rounded-xl2 shadow-card">
                    <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none list-none font-semibold [&::-webkit-details-marker]:hidden">
                      <span className="flex-1">{f.q}</span>
                      <span
                        className="text-muted transition-transform group-open:rotate-180"
                        aria-hidden
                      >
                        ▾
                      </span>
                    </summary>
                    <p className="px-5 pb-5 text-muted leading-relaxed whitespace-pre-wrap">
                      {f.a}
                    </p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Sale / bundle deal */}
      {showSale && (
        <section id="sale" className="max-w-5xl mx-auto px-4 py-16">
          <Reveal>
            <div
              className="rounded-xl2 border-2 shadow-lift px-6 py-8 sm:px-10"
              style={{ borderColor: theme.accent, background: theme.soft }}
            >
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white rounded-full px-3 py-1"
                style={{ background: theme.accent }}
              >
                🎁 {he.saleBadge}
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold mt-4">
                {m.sale.title}
              </h2>
              {m.sale.description && (
                <p className="text-muted mt-3 leading-relaxed whitespace-pre-wrap max-w-2xl">
                  {m.sale.description}
                </p>
              )}
              {m.sale.endsAt && (
                <p className="text-sm font-semibold mt-3" style={{ color: theme.accent }}>
                  ⏳ {he.saleEndsOn}{' '}
                  {new Date(`${m.sale.endsAt}T00:00:00`).toLocaleDateString('he-IL')}
                </p>
              )}
              {salePartner && (
                <div className="mt-6 flex flex-wrap sm:flex-nowrap items-center gap-5 rounded-xl2 border border-line bg-white p-4">
                  {salePartnerCoverUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={salePartnerCoverUrl}
                      alt={salePartner.title}
                      className="w-full sm:w-40 aspect-[4/3] object-cover rounded-xl bg-ink/5 shrink-0"
                    />
                  ) : (
                    <span
                      className="hidden sm:flex w-20 h-20 rounded-xl text-4xl items-center justify-center shrink-0"
                      style={{ background: theme.soft }}
                      aria-hidden
                    >
                      {m.emoji}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-muted">{he.saleIncludedCourse}</p>
                    <h3 className="font-display font-bold text-lg mt-0.5">{salePartner.title}</h3>
                    {salePartner.description && (
                      <p className="text-sm text-muted mt-1 leading-relaxed line-clamp-2">
                        {salePartner.description}
                      </p>
                    )}
                    {salePartner.landingPublished && (
                      <a
                        href={`/t/${slug}/c/${salePartner.id}`}
                        className="inline-block text-sm font-semibold mt-2 hover:underline"
                        style={{ color: theme.main }}
                      >
                        {he.viewCourse} ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-7">
                <a
                  href={saleHref}
                  {...saleExternalProps}
                  className="inline-flex items-center justify-center gap-2 font-display font-bold rounded-xl px-7 py-3.5 text-white transition-transform hover:scale-[1.02] active:scale-[0.99]"
                  style={{ background: theme.accent }}
                >
                  {m.sale.paymentLink && <span aria-hidden>🔒</span>}
                  {he.saleCta}
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* Final CTA */}
      <section
        className="text-white"
        style={{ background: `linear-gradient(140deg, ${theme.deep} 0%, ${theme.main} 100%)` }}
      >
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-bold">{headline}</h2>
            {m.priceText && (
              <p className="text-white/80 text-lg mt-3 font-semibold">{m.priceText}</p>
            )}
            <div className="mt-8">{cta()}</div>
            {(m.contactPhone || m.contactEmail) && (
              <p className="text-white/60 text-sm mt-6" dir="ltr">
                {[m.contactPhone, m.contactEmail].filter(Boolean).join(' · ')}
              </p>
            )}
          </Reveal>
        </div>
      </section>

      <footer className="py-6 border-t border-line">
        <p className="text-center text-sm text-muted">
          {tenant.name} · נבנה עם Kursim
        </p>
      </footer>

      {/* Sticky mobile CTA */}
      <div className="sm:hidden sticky bottom-0 z-40 p-3 bg-white/95 backdrop-blur border-t border-line">
        {cta('w-full')}
      </div>
    </main>
  );
}
