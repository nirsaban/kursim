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
import CourseRevealSequence from '@/components/landing/CourseRevealSequence';
import CountUp from '@/components/landing/CountUp';
import SaleCountdown from '@/components/landing/SaleCountdown';
import Marquee from '@/components/landing/Marquee';
import StickyCta from '@/components/landing/StickyCta';
import ScrollProgress from '@/components/landing/ScrollProgress';
import TiltCard from '@/components/fx/TiltCard';
import Aurora from '@/components/fx/Aurora';
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
  const cta = (extra = '', glow = false) => (
    <a
      href={ctaHref}
      {...externalProps}
      className={`group relative overflow-hidden fx-sheen inline-flex items-center justify-center gap-2.5 font-bold text-[17px] rounded-[16px] px-9 py-4 text-card transition-transform hover:scale-[1.03] active:scale-[0.99] ${
        glow ? 'animate-cta-glow' : ''
      } ${extra}`}
      style={{
        background: `linear-gradient(135deg, ${theme.main}, ${theme.deep})`,
        boxShadow: `0 8px 22px ${theme.main}59`,
      }}
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

  return (
    <main
      className="bg-card text-ink"
      style={
        {
          '--glow': `${theme.main}47`,
          '--glow-strong': `${theme.main}80`,
        } as React.CSSProperties
      }
    >
      <ScrollProgress accent={theme.main} />
      {previewMode && (
        <div className="bg-warn text-white text-center text-sm font-semibold py-2 px-4">
          {he.landingPreview} — {he.landingDraftBadge}
        </div>
      )}

      {/* Sale announcement strip */}
      {showSale && (
        <a
          href="#sale"
          className="block text-center text-sm font-bold text-card py-2.5 px-4 hover:opacity-95"
          style={{ background: theme.main }}
        >
          🎁 {m.sale.title} — <span className="underline">{he.saleCta}</span>
        </a>
      )}

      {/* Mini nav */}
      <header className="sticky top-0 z-40 border-b border-line backdrop-blur bg-card/95">
        <div className="max-w-5xl mx-auto px-4 h-[62px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-9 h-9 rounded-[10px] bg-ink text-paper grid place-items-center font-display font-black text-lg shrink-0"
              aria-hidden
            >
              {tenant.name.charAt(0)}
            </span>
            <span className="font-bold truncate">{tenant.name}</span>
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
              <a href="#sale" className="font-bold" style={{ color: theme.main }}>
                {he.saleBadge}
              </a>
            )}
          </nav>
          <a
            href={ctaHref}
            {...externalProps}
            className="relative overflow-hidden fx-sheen shrink-0 text-sm font-bold text-card rounded-[11px] px-5 py-2.5 transition-transform hover:scale-[1.04]"
            style={{ background: `linear-gradient(135deg, ${theme.main}, ${theme.deep})` }}
          >
            {ctaText}
          </a>
        </div>
      </header>

      {/* AI cinematic hero (scroll-scrubbed Veo sequence) — shown when generated */}
      {cinematic && (
        <CourseRevealSequence
          framesPath={cinematic.framesBaseUrl}
          frameCount={cinematic.frameCount}
          poster={cinematic.posterUrl}
          headline={headline}
          badge={`${m.emoji} ${he.digitalCourseBadge}`}
          accent={theme.main}
        />
      )}

      {/* Hero — two columns per design 1e: copy + before/after showcase */}
      <section
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(180deg, ${theme.soft} 0%, #FFFDF8 100%)` }}
      >
        <Aurora colors={[`${theme.main}30`, `${theme.accent}22`]} />
        <span
          aria-hidden
          className="absolute top-16 end-[8%] w-40 h-40 rounded-full blur-3xl animate-float pointer-events-none"
          style={{ background: `${theme.main}26` }}
        />
        <span
          aria-hidden
          className="absolute bottom-10 start-[12%] w-28 h-28 rounded-full blur-2xl animate-float-slow pointer-events-none"
          style={{ background: `${theme.accent}1F` }}
        />
        <div
          className={`relative max-w-5xl mx-auto px-4 py-16 sm:py-20 ${
            heroMedia ? 'grid gap-12 items-center lg:grid-cols-[1.1fr,1fr]' : ''
          }`}
        >
          <div>
            <Reveal>
              <span
                className="inline-flex items-center gap-2 text-[13px] font-bold rounded-full px-3.5 py-1.5 mb-5 animate-badge-pulse"
                style={{ color: theme.main, background: `${theme.main}1A` }}
              >
                {m.emoji} {he.digitalCourseBadge}
                <span className="relative flex w-2 h-2" aria-hidden>
                  <span
                    className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping"
                    style={{ background: theme.main }}
                  />
                  <span
                    className="relative inline-flex w-2 h-2 rounded-full"
                    style={{ background: theme.main }}
                  />
                </span>
              </span>
              <h1 className="font-display text-4xl sm:text-[52px] font-black leading-[1.15] max-w-3xl text-ink">
                {headline.split(' ').length > 1 ? (
                  <>
                    {headline.split(' ').slice(0, -1).join(' ')}{' '}
                    <span
                      className="bg-clip-text text-transparent animate-gradient-pan"
                      style={{
                        backgroundImage: `linear-gradient(90deg, ${theme.main}, ${theme.accent}, ${theme.main})`,
                        backgroundSize: '200% 100%',
                      }}
                    >
                      {headline.split(' ').at(-1)}
                    </span>
                  </>
                ) : (
                  headline
                )}
              </h1>
              {m.subheadline && (
                <p className="text-lg text-muted mt-5 max-w-2xl leading-relaxed">
                  {m.subheadline}
                </p>
              )}
            </Reveal>
            <Reveal delay={150}>
              <div className="flex flex-wrap items-center gap-4 mt-8">
                {cta('', true)}
                {!heroMedia && m.instructorName && (
                  <span className="text-sm text-muted">
                    {he.withInstructor} <b className="text-ink">{m.instructorName}</b>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 text-[13px] text-muted">
                {trustBullets.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <span className="font-black" style={{ color: theme.main }} aria-hidden>
                      ✓
                    </span>
                    {t}
                  </span>
                ))}
              </div>
              <a
                href={`/t/${slug}/redeem`}
                className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-muted hover:text-ink underline underline-offset-4 decoration-dotted"
              >
                <span aria-hidden>🎟️</span>
                {he.landingHaveCode}
              </a>
              {enrollCount >= 3 && (
                <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className="flex -space-x-2" aria-hidden>
                    {['👩', '🧑', '👨'].map((e, i) => (
                      <span
                        key={i}
                        className="w-7 h-7 rounded-full grid place-items-center text-sm border-2 border-card"
                        style={{ background: theme.soft }}
                      >
                        {e}
                      </span>
                    ))}
                  </span>
                  <b dir="ltr">{enrollCount}+</b> {he.studentsEnrolled}
                </p>
              )}
              <div className="flex flex-wrap items-stretch gap-x-6 gap-y-3 mt-8 text-[13px] text-muted">
                {(
                  [
                    course.modules.length > 0 && {
                      num: course.modules.length,
                      decimals: 0,
                      label: he.modules,
                    },
                    lessonCount > 0 && { num: lessonCount, decimals: 0, label: he.lessons },
                    totalHours && {
                      num: totalHours,
                      decimals: totalHours % 1 ? 1 : 0,
                      label: he.hoursVideo,
                    },
                    avgRating && {
                      num: avgRating,
                      decimals: avgRating % 1 ? 1 : 0,
                      prefix: '★ ',
                      label: he.reviews,
                    },
                  ] as Array<
                    { num: number; decimals: number; prefix?: string; label: string } | false | 0 | null
                  >
                )
                  .filter(
                    (s): s is { num: number; decimals: number; prefix?: string; label: string } =>
                      Boolean(s),
                  )
                  .map((s, i) => (
                    <div key={s.label} className="flex items-stretch gap-6">
                      {i > 0 && <div className="w-px bg-line" aria-hidden />}
                      <div>
                        <CountUp
                          value={s.num}
                          decimals={s.decimals}
                          prefix={s.prefix}
                          className="font-display font-black text-xl text-ink block"
                        />
                        {s.label}
                      </div>
                    </div>
                  ))}
              </div>
            </Reveal>
          </div>

          {heroMedia && (
            <Reveal delay={250}>
              <TiltCard maxTilt={5} className="rounded-[20px]">
                <div className="rounded-[20px] overflow-hidden border border-line shadow-[0_18px_44px_rgba(20,18,10,0.14)]">
                  {heroMedia.kind === 'BEFORE_AFTER' && heroMedia.afterUrl ? (
                    <BeforeAfterSlider
                      beforeUrl={heroMedia.url}
                      afterUrl={heroMedia.afterUrl}
                      beforeLabel={he.beforeLabel}
                      afterLabel={he.afterLabel}
                      accent={theme.main}
                    />
                  ) : heroMedia.kind === 'VIDEO' ? (
                    <video
                      src={heroMedia.url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full aspect-[4/3] object-cover bg-ink/5"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={heroMedia.url}
                      alt={heroMedia.caption || headline}
                      className="w-full aspect-[4/3] object-cover bg-ink/5"
                    />
                  )}
                </div>
              </TiltCard>
              {m.instructorName && (
                <div className="flex items-center gap-3 mt-4 bg-card border border-line rounded-[14px] px-4 py-3">
                  <span
                    className="w-10 h-10 rounded-full grid place-items-center font-display font-black text-card"
                    style={{ background: theme.main }}
                    aria-hidden
                  >
                    {m.instructorName.charAt(0)}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-ink">{m.instructorName}</div>
                    <div className="text-xs text-muted">{he.yourInstructor}</div>
                  </div>
                </div>
              )}
            </Reveal>
          )}

        </div>
        <div className="relative hidden sm:flex justify-center pb-5" aria-hidden>
          <span className="animate-bounce-soft text-muted text-lg">↓</span>
        </div>
      </section>

      {/* Outcomes marquee — the exclusive brand band */}
      <Marquee
        items={m.outcomes.length > 0 ? m.outcomes : m.audience}
        accent={theme.main}
      />

      {/* Who for + outcomes — one section, two columns per design 1e */}
      {(m.audience.length > 0 || m.outcomes.length > 0) && (
        <section className="border-t border-line">
          <div
            className={`max-w-5xl mx-auto px-4 py-16 ${
              m.audience.length > 0 && m.outcomes.length > 0
                ? 'grid gap-12 lg:grid-cols-[1fr,1.3fr]'
                : ''
            }`}
          >
            {m.audience.length > 0 && (
              <div>
                <Reveal>
                  <h2 className="font-display text-2xl sm:text-3xl font-black mb-5">
                    {he.audienceTitle}
                  </h2>
                </Reveal>
                <div className="flex flex-col gap-2.5">
                  {m.audience.map((a, i) => (
                    <Reveal key={i} delay={i * 80}>
                      <div className="flex items-start gap-3 rounded-[13px] bg-paper px-4 py-3.5 leading-relaxed">
                        <span
                          className="font-black shrink-0"
                          style={{ color: theme.main }}
                          aria-hidden
                        >
                          ✓
                        </span>
                        <span className="text-[15px]">{a}</span>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            )}
            {m.outcomes.length > 0 && (
              <div>
                <Reveal>
                  <h2 className="font-display text-2xl sm:text-3xl font-black mb-5">
                    {he.outcomesTitle}
                  </h2>
                </Reveal>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {m.outcomes.map((o, i) => (
                    <Reveal key={i} delay={i * 60}>
                      <li className="border border-line rounded-[13px] px-5 py-4 h-full">
                        <span
                          className="font-display font-black text-xl block"
                          style={{ color: theme.main }}
                          aria-hidden
                          dir="ltr"
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="leading-relaxed text-sm mt-1 block">{o}</span>
                      </li>
                    </Reveal>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Benefits */}
      {m.benefits.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-16">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl font-black mb-8">
              {he.benefitsTitle}
            </h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {m.benefits.map((b, i) => (
              <Reveal key={i} delay={i * 80} className="h-full">
                <div className="group relative overflow-hidden border border-line rounded-xl2 p-6 h-full shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1 origin-center scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                    style={{ background: `linear-gradient(90deg, ${theme.main}, ${theme.accent})` }}
                  />
                  <span
                    className="inline-flex w-10 h-10 rounded-xl text-card items-center justify-center font-display font-bold transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
                    style={{ background: `linear-gradient(135deg, ${theme.main}, ${theme.deep})` }}
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
      {galleryRest.length > 0 && (
        <section id="gallery" className="max-w-5xl mx-auto px-4 py-16">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl font-black mb-8">
              {he.galleryTitle}
            </h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2">
            {galleryRest.map((item, i) => (
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

      {/* Curriculum — the dark ink chapter */}
      {lessonCount > 0 && (
        <section id="curriculum" className="relative overflow-hidden bg-ink fx-grain">
          <Aurora colors={[`${theme.main}40`, `${theme.accent}26`]} />
          <div className="relative max-w-3xl mx-auto px-4 py-16">
            <Reveal>
              <h2 className="font-display text-2xl sm:text-3xl font-black mb-1.5 text-paper">
                {he.curriculum}
              </h2>
              <p className="text-sm text-brand-300 mb-7">
                <span dir="ltr">{course.modules.length}</span> {he.modules} ·{' '}
                <span dir="ltr">{lessonCount}</span> {he.lessons}
                {totalHours && (
                  <>
                    {' '}
                    · <span dir="ltr">{totalHours}</span> {he.hoursVideo}
                  </>
                )}
              </p>
            </Reveal>
            <div className="space-y-2.5">
              {course.modules.map((mod, mi) => (
                <Reveal key={mod.id} delay={mi * 60}>
                  <details
                    className="group bg-ink-surface border border-paper/10 rounded-[15px] overflow-hidden"
                    open={mi === 0}
                  >
                    <summary className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                      <span
                        className="font-display font-black text-lg shrink-0"
                        style={{ color: theme.main }}
                        dir="ltr"
                      >
                        {String(mi + 1).padStart(2, '0')}
                      </span>
                      <span className="font-bold flex-1 text-paper">{mod.title}</span>
                      <span className="text-xs text-brand-300">
                        {mod.lessons.length} {he.lessons}
                      </span>
                      <span
                        className="text-brand-300 transition-transform group-open:rotate-180"
                        aria-hidden
                      >
                        ▾
                      </span>
                    </summary>
                    <ul className="border-t border-paper/10 px-5 py-2.5 space-y-1">
                      {mod.lessons.map((l) => (
                        <li key={l.id} className="flex items-center gap-3 py-1.5 text-sm">
                          <span
                            className="w-[26px] h-[26px] rounded-lg bg-paper/10 text-paper text-[10px] grid place-items-center shrink-0"
                            aria-hidden
                          >
                            ▶
                          </span>
                          <span className="flex-1 text-paper/85">{l.title}</span>
                          {l.durationSec ? (
                            <span
                              className="text-xs tabular-nums font-mono text-brand-300"
                              dir="ltr"
                            >
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

            {/* Mid-page conversion moment — right after the syllabus sold them */}
            <Reveal delay={120}>
              <div className="mt-12 text-center">
                <p className="font-display text-2xl font-black text-paper">{he.midCtaTitle}</p>
                <p className="text-sm text-brand-300 mt-1.5">{he.midCtaSubtitle}</p>
                <div className="mt-5 flex justify-center">{cta('', true)}</div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {m.testimonials.length > 0 && (
        <section id="testimonials" className="max-w-5xl mx-auto px-4 py-16">
          <Reveal>
            <h2 className="font-display text-2xl sm:text-3xl font-black mb-8">
              {he.testimonialsTitle}
            </h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2">
            {m.testimonials.map((t, i) => (
              <Reveal key={i} delay={i * 80}>
                <figure
                  className="rounded-xl2 p-6 h-full border transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
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
                      className="w-9 h-9 rounded-full text-card font-display font-bold text-sm flex items-center justify-center"
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
            <h2 className="font-display text-2xl sm:text-3xl font-black mb-2">
              {he.reviewsTitle}
            </h2>
            <p className="text-muted mb-8">{he.verifiedStudent} ✓</p>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r, i) => (
              <Reveal key={r.id} delay={i * 70}>
                <figure className="border border-line rounded-2xl p-5 h-full bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
                  <div className="text-coin text-[15px] tracking-[2px]" aria-label={`${r.rating}/5`}>
                    {'★'.repeat(r.rating)}
                    <span className="text-line">{'★'.repeat(5 - r.rating)}</span>
                  </div>
                  <blockquote className="mt-3 leading-relaxed text-sm">{r.text}</blockquote>
                  <figcaption className="mt-4 text-sm">
                    <span className="font-bold block">{r.name || he.verifiedStudent}</span>
                    <span className="text-[11px] font-semibold text-ok">
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

      {/* Sale / bundle deal */}
      {showSale && (
        <section id="sale" className="max-w-5xl mx-auto px-4 py-16">
          <Reveal>
            <div
              className="rounded-xl2 border-2 shadow-lift px-6 py-8 sm:px-10"
              style={{ borderColor: theme.accent, background: theme.soft }}
            >
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold text-card rounded-full px-3 py-1 animate-badge-pulse"
                style={{ background: theme.accent }}
              >
                🎁 {he.saleBadge}
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-black mt-4">
                {m.sale.title}
              </h2>
              {m.sale.description && (
                <p className="text-muted mt-3 leading-relaxed whitespace-pre-wrap max-w-2xl">
                  {m.sale.description}
                </p>
              )}
              {m.sale.endsAt && (
                <>
                  <SaleCountdown endsAt={m.sale.endsAt} accent={theme.accent} />
                  <p className="text-xs text-muted mt-2">
                    {he.saleEndsOn}{' '}
                    {new Date(`${m.sale.endsAt}T00:00:00`).toLocaleDateString('he-IL')}
                  </p>
                </>
              )}
              {salePartner && (
                <div className="mt-6 flex flex-wrap sm:flex-nowrap items-center gap-5 rounded-xl2 border border-line bg-card p-4">
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
                  className="group relative overflow-hidden fx-sheen inline-flex items-center justify-center gap-2 font-bold rounded-[14px] px-8 py-3.5 text-card transition-transform hover:scale-[1.03] active:scale-[0.99] animate-cta-glow"
                  style={{
                    background: `linear-gradient(135deg, ${theme.main}, ${theme.deep})`,
                    boxShadow: `0 8px 22px ${theme.main}59`,
                  }}
                >
                  {m.sale.paymentLink && <span aria-hidden>🔒</span>}
                  {he.saleCta}
                  <span
                    aria-hidden
                    className="transition-transform duration-300 group-hover:-translate-x-1"
                  >
                    ←
                  </span>
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* FAQ + CTA band — side by side per design 1e */}
      <section id="faq" className="max-w-5xl mx-auto px-4 pb-16 pt-4">
        <div
          className={
            m.faq.length > 0 ? 'grid gap-12 lg:grid-cols-2 items-start' : ''
          }
        >
          {m.faq.length > 0 && (
            <div>
              <Reveal>
                <h2 className="font-display text-2xl sm:text-3xl font-black mb-5">
                  {he.faqTitle}
                </h2>
              </Reveal>
              <div className="space-y-2.5">
                {m.faq.map((f, i) => (
                  <Reveal key={i} delay={i * 50}>
                    <details className="group bg-card border border-line rounded-[13px]">
                      <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none list-none font-bold text-[15px] [&::-webkit-details-marker]:hidden">
                        <span className="flex-1">{f.q}</span>
                        <span className="text-muted group-open:hidden" aria-hidden>
                          +
                        </span>
                        <span
                          className="hidden group-open:inline"
                          style={{ color: theme.main }}
                          aria-hidden
                        >
                          −
                        </span>
                      </summary>
                      <p className="px-5 pb-5 text-sm text-muted leading-relaxed whitespace-pre-wrap">
                        {f.a}
                      </p>
                    </details>
                  </Reveal>
                ))}
              </div>
            </div>
          )}

          <Reveal delay={120}>
            <div
              className="relative overflow-hidden rounded-[22px] text-paper px-8 py-9 fx-grain"
              style={{
                background: `radial-gradient(ellipse at 15% 115%, ${theme.main}59, transparent 55%), #12151D`,
              }}
            >
              <Aurora colors={[`${theme.main}4D`, `${theme.accent}33`]} />
              <div className="relative">
                <h2 className="font-display text-3xl font-black text-paper leading-snug">
                  {headline}
                </h2>
                <p className="text-brand-300 text-sm leading-relaxed mt-3 max-w-md">
                  {he.ctaAccessNote.replace('{n}', String(tenant.sessionLimit))}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  {cta()}
                  <span className="text-xs text-brand-300">{he.ctaCoinsNote}</span>
                </div>
                {(m.contactPhone || m.contactEmail) && (
                  <p className="text-brand-400 text-sm mt-5" dir="ltr">
                    {[m.contactPhone, m.contactEmail].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* extra bottom padding keeps the fixed conversion bar from covering the footer */}
      <footer className="pt-6 pb-24 border-t border-line bg-card">
        <p className="text-center text-sm text-muted">
          {tenant.name} · {he.landingBuiltWith}
        </p>
      </footer>

      {/* Sticky conversion bar — slides up after the visitor scrolls past the hero */}
      <StickyCta
        href={ctaHref}
        external={ctaExternal}
        text={ctaText}
        priceText={m.priceText || undefined}
        note={he.ctaAccessNote.replace('{n}', String(tenant.sessionLimit))}
        accent={theme.main}
        deep={theme.deep}
        locked={Boolean(m.paymentLink)}
      />
    </main>
  );
}
