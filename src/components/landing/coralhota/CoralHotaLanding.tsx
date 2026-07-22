import Reveal from '@/components/landing/Reveal';
import BeforeAfterSlider from '@/components/landing/BeforeAfterSlider';
import CourseRevealSequence from '@/components/landing/CourseRevealSequence';
import CountUp from '@/components/landing/CountUp';
import SaleCountdown from '@/components/landing/SaleCountdown';
import StickyCta from '@/components/landing/StickyCta';
import ScrollProgress from '@/components/landing/ScrollProgress';
import { he } from '@/lib/he';
import type { LandingProps } from '@/components/landing/landing-types';
import { BENEFIT_ICONS, IconClock, IconLayers, IconPlay, IconStar } from './icons';
import CoralHeader from './CoralHeader';
import GalleryCarousel from './GalleryCarousel';

const CREAM = '#EEEBE3';

/**
 * "Coral Hota" template — a boutique-bakery-style alternate skin: cream +
 * near-black + one warm script accent, solid pill buttons, thin-border
 * cards. Owners opt in per-course via marketing.layout; see LANDING_LAYOUTS.
 */
export default function CoralHotaLanding({
  slug,
  tenantName,
  sessionLimit,
  modules,
  m,
  theme,
  previewMode,
  headline,
  ctaHref,
  ctaText,
  ctaExternal,
  externalProps,
  trustBullets,
  lessonCount,
  reviews,
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
}: LandingProps) {
  const introImage = heroMedia ?? gallery[0] ?? null;
  const curriculumImage = gallery[0] ?? heroMedia ?? null;
  const headlineWords = headline.split(' ');
  const stats = (
    [
      modules.length > 0 && { num: modules.length, decimals: 0, label: he.modules, Icon: IconLayers },
      lessonCount > 0 && { num: lessonCount, decimals: 0, label: he.lessons, Icon: IconPlay },
      totalHours && { num: totalHours, decimals: totalHours % 1 ? 1 : 0, label: he.hoursVideo, Icon: IconClock },
      avgRating && { num: avgRating, decimals: avgRating % 1 ? 1 : 0, prefix: '★ ', label: he.reviews, Icon: IconStar },
    ] as Array<
      { num: number; decimals: number; prefix?: string; label: string; Icon: typeof IconPlay } | false | 0 | null
    >
  ).filter(
    (s): s is { num: number; decimals: number; prefix?: string; label: string; Icon: typeof IconPlay } =>
      Boolean(s),
  );

  const pill = (extra = '', big = false) => (
    <a
      href={ctaHref}
      {...externalProps}
      className={`inline-flex items-center justify-center gap-2 font-bold rounded-full bg-black text-white transition-transform hover:scale-[1.03] active:scale-[0.98] ${
        big ? 'text-[17px] px-9 py-4' : 'text-sm px-6 py-3'
      } ${extra}`}
    >
      {m.paymentLink && <span aria-hidden>🔒</span>}
      {ctaText}
      {m.priceText && <span className="font-medium opacity-80">· {m.priceText}</span>}
    </a>
  );

  return (
    <main id="top" className="text-[#160303]" style={{ background: CREAM }}>
      <ScrollProgress accent="#160303" />
      {previewMode && (
        <div className="bg-warn text-white text-center text-sm font-semibold py-2 px-4">
          {he.landingPreview} — {he.landingDraftBadge}
        </div>
      )}

      {showSale && (
        <a
          href="#sale"
          className="block text-center text-sm font-bold text-white py-2.5 px-4 hover:opacity-90 bg-black"
        >
          🎁 {m.sale.title} — <span className="underline">{he.saleCta}</span>
        </a>
      )}

      {/* Sticky header — transparent over the hero, solidifies on scroll */}
      <CoralHeader
        tenantName={tenantName}
        tenantBrandColor={theme.main}
        ctaHref={ctaHref}
        ctaText={ctaText}
        externalProps={externalProps}
        navLinks={(
          [
            lessonCount > 0 && { href: '#curriculum', label: he.curriculum },
            m.testimonials.length > 0 && { href: '#testimonials', label: he.testimonialsTitle },
            m.faq.length > 0 && { href: '#faq', label: he.faqTitle },
          ] as Array<{ href: string; label: string } | false>
        ).filter((l): l is { href: string; label: string } => Boolean(l))}
      />

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

      {/* Hero — full-bleed dark stage, centered copy, script accent word.
          Pulled up under the (initially transparent) sticky header so the
          header visually blends into it until the visitor scrolls. */}
      <section
        className={`relative overflow-hidden fx-grain ${cinematic ? '' : '-mt-[68px] pt-[68px]'}`}
        style={{ background: `linear-gradient(180deg, #12151D 0%, #12151D 58%, ${CREAM} 100%)` }}
      >
        <div className="relative max-w-3xl mx-auto px-4 py-20 sm:py-28 text-center flex flex-col items-center">
          <Reveal>
            {/* Badge + headline already appear overlaid on the cinematic
                video above — repeating them here would be redundant. */}
            {!cinematic && (
              <>
                <span
                  className="inline-flex items-center gap-2 text-[13px] font-bold rounded-full px-3.5 py-1.5 mb-6 text-white"
                  style={{ background: 'rgba(245,242,235,0.12)' }}
                >
                  {m.emoji} {he.digitalCourseBadge}
                </span>
                <h1 className="font-body font-extrabold text-4xl sm:text-6xl leading-[1.1] text-white">
                  {headlineWords.length > 1 ? headlineWords.slice(0, -1).join(' ') : headline}
                </h1>
                {headlineWords.length > 1 && (
                  <span className="relative inline-block mt-1">
                    <span
                      className="font-script font-bold text-5xl sm:text-7xl leading-none block"
                      style={{ color: theme.accent }}
                    >
                      {headlineWords.at(-1)}
                    </span>
                    <svg
                      viewBox="0 0 200 14"
                      className="w-full h-3 mt-1"
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      <path
                        d="M2 8C40 2 80 12 100 7C120 2 160 12 198 6"
                        fill="none"
                        stroke={theme.accent}
                        strokeWidth="3"
                        strokeLinecap="round"
                        opacity="0.7"
                      />
                    </svg>
                  </span>
                )}
              </>
            )}
            {m.subheadline && (
              <p className="text-lg text-white/70 mt-6 max-w-xl mx-auto leading-relaxed">{m.subheadline}</p>
            )}
          </Reveal>
          <Reveal delay={150}>
            <div className="mt-9">{pill('', true)}</div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-6 text-[13px] text-white/70">
              {trustBullets.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span className="font-black" style={{ color: theme.accent }} aria-hidden>
                    ✓
                  </span>
                  {t}
                </span>
              ))}
            </div>
            <a
              href={`/t/${slug}/redeem`}
              className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-white/70 hover:text-white underline underline-offset-4 decoration-dotted"
            >
              <span aria-hidden>🎟️</span>
              {he.landingHaveCode}
            </a>
          </Reveal>
        </div>
      </section>

      {/* Intro — welcome paragraph beside a photo, per the reference's two-column opener */}
      {(m.aboutSchool || introImage) && (
        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className={`grid gap-10 items-center ${introImage ? 'lg:grid-cols-[1.1fr,1fr]' : ''}`}>
            <Reveal>
              <div>
                {m.aboutSchool && (
                  <p className="text-lg leading-relaxed whitespace-pre-wrap">{m.aboutSchool}</p>
                )}
                <div className="mt-7">{pill()}</div>
              </div>
            </Reveal>
            {introImage && (
              <Reveal delay={120}>
                <div className="rounded-[24px] overflow-hidden border border-black/10">
                  {introImage.kind === 'VIDEO' ? (
                    <video
                      src={introImage.url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full aspect-[4/3] object-cover"
                    />
                  ) : introImage.kind === 'BEFORE_AFTER' && introImage.afterUrl ? (
                    <BeforeAfterSlider
                      beforeUrl={introImage.url}
                      afterUrl={introImage.afterUrl}
                      beforeLabel={he.beforeLabel}
                      afterLabel={he.afterLabel}
                      accent={theme.main}
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={introImage.url}
                      alt={introImage.caption || headline}
                      className="w-full aspect-[4/3] object-cover"
                    />
                  )}
                </div>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* Stats row — outlined pill cards */}
      {stats.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 pb-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 70}>
                <div className="border border-black/12 rounded-2xl px-4 py-6 text-center h-full bg-white/40">
                  <span
                    className="inline-flex w-11 h-11 rounded-full items-center justify-center mb-3"
                    style={{ background: theme.soft, color: theme.main }}
                    aria-hidden
                  >
                    <s.Icon className="w-5 h-5" />
                  </span>
                  <CountUp
                    value={s.num}
                    decimals={s.decimals}
                    prefix={s.prefix}
                    className="font-body font-extrabold text-2xl block"
                  />
                  <span className="text-sm text-[#160303]/70">{s.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* What's included — icon grid, no card chrome, matching the reference's illustrated grid */}
      {m.benefits.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 py-16">
          <Reveal>
            <h2 className="font-body font-extrabold text-2xl sm:text-3xl text-center mb-10">
              {he.whatsIncludedTitle}
            </h2>
          </Reveal>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {m.benefits.map((b, i) => {
              const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length];
              return (
                <Reveal key={i} delay={i * 70}>
                  <div className="text-center">
                    <span
                      className="inline-flex w-16 h-16 rounded-full items-center justify-center mb-4"
                      style={{ background: theme.soft, color: theme.main }}
                      aria-hidden
                    >
                      <Icon className="w-7 h-7" />
                    </span>
                    <h3 className="font-bold text-base">{b.title}</h3>
                    {b.body && <p className="text-sm text-[#160303]/70 mt-1.5 leading-relaxed">{b.body}</p>}
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {/* Who for + outcomes */}
      {(m.audience.length > 0 || m.outcomes.length > 0) && (
        <section className="border-t border-black/10">
          <div
            className={`max-w-5xl mx-auto px-4 py-16 ${
              m.audience.length > 0 && m.outcomes.length > 0 ? 'grid gap-12 lg:grid-cols-2' : ''
            }`}
          >
            {m.audience.length > 0 && (
              <div>
                <Reveal>
                  <h2 className="font-body font-extrabold text-2xl mb-5">{he.audienceTitle}</h2>
                </Reveal>
                <div className="flex flex-col gap-2.5">
                  {m.audience.map((a, i) => (
                    <Reveal key={i} delay={i * 70}>
                      <div className="flex items-start gap-3 rounded-2xl bg-white/50 border border-black/8 px-4 py-3.5">
                        <span className="font-black shrink-0" style={{ color: theme.main }} aria-hidden>
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
                  <h2 className="font-body font-extrabold text-2xl mb-5">{he.outcomesTitle}</h2>
                </Reveal>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {m.outcomes.map((o, i) => (
                    <Reveal key={i} delay={i * 60}>
                      <li className="border border-black/12 rounded-2xl px-5 py-4 h-full bg-white/40">
                        <span className="text-sm leading-relaxed">{o}</span>
                      </li>
                    </Reveal>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Curriculum — sticky photo beside module cards */}
      {lessonCount > 0 && (
        <section id="curriculum" className="max-w-5xl mx-auto px-4 py-16 border-t border-black/10">
          <Reveal>
            <h2 className="font-body font-extrabold text-2xl sm:text-3xl mb-1.5">{he.curriculum}</h2>
            <p className="text-sm text-[#160303]/60 mb-9">
              <span dir="ltr">{modules.length}</span> {he.modules} · <span dir="ltr">{lessonCount}</span>{' '}
              {he.lessons}
              {totalHours && (
                <>
                  {' '}
                  · <span dir="ltr">{totalHours}</span> {he.hoursVideo}
                </>
              )}
            </p>
          </Reveal>
          <div className={curriculumImage ? 'grid gap-10 lg:grid-cols-[1fr,1.3fr] items-start' : ''}>
            {curriculumImage && (
              <Reveal className="lg:sticky lg:top-24">
                <div className="rounded-[24px] overflow-hidden border border-black/10">
                  {curriculumImage.kind === 'VIDEO' ? (
                    <video
                      src={curriculumImage.url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full aspect-[4/3] object-cover"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={curriculumImage.url}
                      alt={curriculumImage.caption || headline}
                      className="w-full aspect-[4/3] object-cover"
                    />
                  )}
                </div>
              </Reveal>
            )}
            <div className="space-y-3">
              {modules.map((mod, mi) => (
                <Reveal key={mod.id} delay={mi * 60}>
                  <details className="group bg-white/60 border border-black/12 rounded-2xl overflow-hidden" open={mi === 0}>
                    <summary className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                      <span className="font-body font-extrabold text-lg shrink-0" style={{ color: theme.main }} dir="ltr">
                        {String(mi + 1).padStart(2, '0')}
                      </span>
                      <span className="font-bold flex-1">{mod.title}</span>
                      <span className="text-xs text-[#160303]/60">
                        {mod.lessons.length} {he.lessons}
                      </span>
                      <span className="text-[#160303]/50 transition-transform group-open:rotate-180" aria-hidden>
                        ▾
                      </span>
                    </summary>
                    <ul className="border-t border-black/10 px-5 py-2.5 space-y-1">
                      {mod.lessons.map((l) => (
                        <li key={l.id} className="flex items-center gap-3 py-1.5 text-sm">
                          <span
                            className="w-[26px] h-[26px] rounded-lg grid place-items-center shrink-0"
                            style={{ background: theme.soft, color: theme.main }}
                            aria-hidden
                          >
                            <IconPlay className="w-3.5 h-3.5" />
                          </span>
                          <span className="flex-1 text-[#160303]/85">{l.title}</span>
                          {l.durationSec ? (
                            <span className="text-xs tabular-nums font-mono text-[#160303]/50" dir="ltr">
                              {Math.floor(l.durationSec / 60)}:{String(l.durationSec % 60).padStart(2, '0')}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                </Reveal>
              ))}

              <Reveal delay={120}>
                <div className="pt-6 text-center">
                  <p className="font-body font-extrabold text-xl">{he.midCtaTitle}</p>
                  <p className="text-sm text-[#160303]/60 mt-1.5">{he.midCtaSubtitle}</p>
                  <div className="mt-5 flex justify-center">{pill('', true)}</div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {/* Gallery — horizontal scroll strip, matching the reference's "moments" carousel */}
      {galleryRest.length > 0 && (
        <section id="gallery" className="py-16 border-t border-black/10">
          <div className="max-w-5xl mx-auto px-4">
            <Reveal>
              <h2 className="font-body font-extrabold text-2xl sm:text-3xl mb-8">{he.galleryTitle}</h2>
            </Reveal>
          </div>
          <GalleryCarousel>
            {galleryRest.map((item, i) => (
              <Reveal key={i} delay={i * 60} className="shrink-0 w-[280px] snap-start">
                <figure>
                  <div className="rounded-2xl overflow-hidden border border-black/10 relative">
                    {item.kind === 'VIDEO' ? (
                      <video
                        src={item.url}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full aspect-[4/3] object-cover"
                      />
                    ) : item.kind === 'BEFORE_AFTER' && item.afterUrl ? (
                      <BeforeAfterSlider
                        beforeUrl={item.url}
                        afterUrl={item.afterUrl}
                        beforeLabel={he.beforeLabel}
                        afterLabel={he.afterLabel}
                        accent={theme.main}
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.url}
                        alt={item.caption || he.galleryTitle}
                        loading="lazy"
                        className="w-full aspect-[4/3] object-cover"
                      />
                    )}
                  </div>
                  {item.caption && <figcaption className="text-sm text-[#160303]/60 mt-2 px-1">{item.caption}</figcaption>}
                </figure>
              </Reveal>
            ))}
          </GalleryCarousel>
        </section>
      )}

      {/* Sale / bundle */}
      {showSale && (
        <section id="sale" className="max-w-5xl mx-auto px-4 py-16 border-t border-black/10">
          <Reveal>
            <div className="rounded-[24px] border-2 px-6 py-8 sm:px-10 bg-white/60" style={{ borderColor: theme.accent }}>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white rounded-full px-3 py-1 bg-black"
              >
                🎁 {he.saleBadge}
              </span>
              <h2 className="font-body font-extrabold text-2xl sm:text-3xl mt-4">{m.sale.title}</h2>
              {m.sale.description && (
                <p className="text-[#160303]/70 mt-3 leading-relaxed whitespace-pre-wrap max-w-2xl">
                  {m.sale.description}
                </p>
              )}
              {m.sale.endsAt && (
                <>
                  <SaleCountdown endsAt={m.sale.endsAt} accent={theme.accent} />
                  <p className="text-xs text-[#160303]/60 mt-2">
                    {he.saleEndsOn} {new Date(`${m.sale.endsAt}T00:00:00`).toLocaleDateString('he-IL')}
                  </p>
                </>
              )}
              {salePartner && (
                <div className="mt-6 flex flex-wrap sm:flex-nowrap items-center gap-5 rounded-2xl border border-black/10 bg-white p-4">
                  {salePartnerCoverUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={salePartnerCoverUrl}
                      alt={salePartner.title}
                      className="w-full sm:w-40 aspect-[4/3] object-cover rounded-xl shrink-0"
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
                    <p className="text-xs font-semibold text-[#160303]/60">{he.saleIncludedCourse}</p>
                    <h3 className="font-bold text-lg mt-0.5">{salePartner.title}</h3>
                    {salePartner.description && (
                      <p className="text-sm text-[#160303]/70 mt-1 leading-relaxed line-clamp-2">
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
                  className="inline-flex items-center justify-center gap-2 font-bold rounded-full px-8 py-3.5 text-white bg-black transition-transform hover:scale-[1.03] active:scale-[0.99]"
                >
                  {m.sale.paymentLink && <span aria-hidden>🔒</span>}
                  {he.saleCta}
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* Testimonials */}
      {m.testimonials.length > 0 && (
        <section id="testimonials" className="max-w-5xl mx-auto px-4 py-16 border-t border-black/10">
          <Reveal>
            <h2 className="font-body font-extrabold text-2xl sm:text-3xl mb-8">{he.testimonialsTitle}</h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2">
            {m.testimonials.map((t, i) => (
              <Reveal key={i} delay={i * 70}>
                <figure className="rounded-[20px] p-6 h-full border" style={{ background: theme.soft, borderColor: `${theme.main}26` }}>
                  <span className="text-4xl leading-none block mb-2" style={{ color: theme.main }} aria-hidden>
                    ”
                  </span>
                  <blockquote className="leading-relaxed">{t.quote}</blockquote>
                  <figcaption className="flex items-center gap-2.5 mt-4">
                    <span
                      className="w-9 h-9 rounded-full text-white font-bold text-sm flex items-center justify-center"
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

      {/* Verified reviews */}
      {reviews.length > 0 && (
        <section id="reviews" className="max-w-5xl mx-auto px-4 py-16 border-t border-black/10">
          <Reveal>
            <h2 className="font-body font-extrabold text-2xl sm:text-3xl mb-2">{he.reviewsTitle}</h2>
            <p className="text-[#160303]/60 mb-8">{he.verifiedStudent} ✓</p>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r, i) => (
              <Reveal key={r.id} delay={i * 60}>
                <figure className="border border-black/12 rounded-2xl p-5 h-full bg-white/50">
                  <div className="text-coin text-[15px] tracking-[2px]" aria-label={`${r.rating}/5`}>
                    {'★'.repeat(r.rating)}
                    <span className="text-black/15">{'★'.repeat(5 - r.rating)}</span>
                  </div>
                  <blockquote className="mt-3 leading-relaxed text-sm">{r.text}</blockquote>
                  <figcaption className="mt-4 text-sm">
                    <span className="font-bold block">{r.name || he.verifiedStudent}</span>
                    <span className="text-[11px] font-semibold text-ok">✓ {he.verifiedStudent}</span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      {m.faq.length > 0 && (
        <section id="faq" className="max-w-3xl mx-auto px-4 py-16 border-t border-black/10">
          <Reveal>
            <h2 className="font-body font-extrabold text-2xl sm:text-3xl mb-6 text-center">{he.faqTitle}</h2>
          </Reveal>
          <div className="space-y-2.5">
            {m.faq.map((f, i) => (
              <Reveal key={i} delay={i * 45}>
                <details className="group bg-white/50 border border-black/12 rounded-2xl">
                  <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none list-none font-bold text-[15px] [&::-webkit-details-marker]:hidden">
                    <span className="flex-1">{f.q}</span>
                    <span className="text-[#160303]/50 group-open:hidden" aria-hidden>
                      +
                    </span>
                    <span className="hidden group-open:inline" style={{ color: theme.main }} aria-hidden>
                      −
                    </span>
                  </summary>
                  <p className="px-5 pb-5 text-sm text-[#160303]/70 leading-relaxed whitespace-pre-wrap">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* Closing CTA — plain and repeated, matching the reference's understated recurring button */}
      <section className="max-w-2xl mx-auto px-4 py-16 text-center border-t border-black/10">
        <Reveal>
          <h2 className="font-body font-extrabold text-2xl sm:text-3xl leading-snug">{headline}</h2>
          <p className="text-[#160303]/60 text-sm leading-relaxed mt-3 max-w-md mx-auto">
            {he.ctaAccessNote.replace('{n}', String(sessionLimit))}
          </p>
          <div className="mt-6 flex justify-center">{pill('', true)}</div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/10 pt-12 pb-24">
        <div className="max-w-5xl mx-auto px-4 grid gap-8 sm:grid-cols-3 text-sm">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className="w-8 h-8 rounded-full text-white grid place-items-center font-bold shrink-0"
                style={{ background: theme.main }}
                aria-hidden
              >
                {tenantName.charAt(0)}
              </span>
              <span className="font-extrabold">{tenantName}</span>
            </div>
            <p className="text-[#160303]/60 mt-3">{he.landingBuiltWith}</p>
          </div>
          <div>
            <p className="font-bold mb-2.5">{he.footerQuickLinks}</p>
            <div className="flex flex-col gap-1.5 text-[#160303]/70">
              {lessonCount > 0 && <a href="#curriculum" className="hover:text-[#160303]">{he.curriculum}</a>}
              {m.testimonials.length > 0 && (
                <a href="#testimonials" className="hover:text-[#160303]">{he.testimonialsTitle}</a>
              )}
              {m.faq.length > 0 && <a href="#faq" className="hover:text-[#160303]">{he.faqTitle}</a>}
              <a href={`/t/${slug}/redeem`} className="hover:text-[#160303]">{he.landingHaveCode}</a>
            </div>
          </div>
          <div>
            <p className="font-bold mb-2.5">{he.footerContact}</p>
            <div className="flex flex-col gap-1.5 text-[#160303]/70">
              {m.contactPhone && <span dir="ltr">{m.contactPhone}</span>}
              {m.contactEmail && <span dir="ltr">{m.contactEmail}</span>}
              <a href="#top" className="hover:text-[#160303] mt-1.5">
                ↑ {he.scrollToTop}
              </a>
            </div>
          </div>
        </div>
      </footer>

      <StickyCta
        href={ctaHref}
        external={ctaExternal}
        text={ctaText}
        priceText={m.priceText || undefined}
        note={he.ctaAccessNote.replace('{n}', String(sessionLimit))}
        accent="#000000"
        deep="#000000"
        locked={Boolean(m.paymentLink)}
      />
    </main>
  );
}
