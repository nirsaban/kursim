import Link from 'next/link';
import type { LandingTheme } from '@/lib/landing-themes';
import type { CollectionContent } from '@/lib/validation/collection';
import type { Socials } from '@/lib/validation/links';
import SocialLinks from '@/components/landing/SocialLinks';
import Reveal from '@/components/landing/Reveal';
import { he } from '@/lib/he';

export interface CollectionCourseCard {
  id: string;
  title: string;
  description: string;
  emoji: string;
  coverUrl: string | null;
  outcomes: string[];
  lessonCount: number;
  totalHours: number;
  priceLabel: string;
  strikeLabel: string | null;
  /** null → nothing to link to (unpriced and unpublished) */
  ctaHref: string | null;
  ctaText: string;
  detailsHref: string | null;
  addons: Array<{ id: string; title: string; priceLabel: string; href: string }>;
}

/**
 * Compact multi-course landing. Deliberately no story/benefits/FAQ — a hero
 * that says "several courses, pick yours", then one card per course with its
 * own payment button. Add-on links go to the same checkout with ?addon= so
 * the buyer can take a second course in one charge, but each card is a
 * separate purchase path.
 */
export default function CollectionLanding({
  tenantName,
  content,
  theme,
  cards,
  socials,
  previewMode,
}: {
  tenantName: string;
  content: CollectionContent;
  theme: LandingTheme;
  cards: CollectionCourseCard[];
  socials: Socials;
  previewMode: boolean;
}) {
  const countLabel =
    cards.length === 2
      ? he.collectionCoursesCountTwo
      : he.collectionCoursesCount.replace('{n}', String(cards.length));
  const headline = content.headline || he.collectionChooseCourse;

  return (
    <div className="min-h-screen bg-paper text-ink" dir="rtl">
      {previewMode && (
        <div className="bg-warn-soft text-warn text-center text-xs font-semibold py-2 px-4">
          {he.landingDraftBadge}
        </div>
      )}

      {/* Hero */}
      <header
        className="relative overflow-hidden text-white"
        style={{ background: `linear-gradient(135deg, ${theme.deep} 0%, ${theme.main} 100%)` }}
      >
        <div className="max-w-5xl mx-auto px-5 pt-14 pb-16 sm:pt-20 sm:pb-24 text-center">
          <p className="text-xs font-bold tracking-wider uppercase opacity-80 mb-3">{tenantName}</p>
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold mb-5"
            style={{ background: 'rgba(255,255,255,0.16)' }}
          >
            <span aria-hidden>{content.emoji}</span>
            {countLabel}
          </span>
          <h1 className="font-display text-3xl sm:text-5xl font-black leading-tight max-w-3xl mx-auto">
            {headline}
          </h1>
          {content.subheadline && (
            <p className="mt-4 text-base sm:text-lg opacity-90 max-w-2xl mx-auto leading-relaxed">
              {content.subheadline}
            </p>
          )}
          <p className="mt-6 text-sm font-semibold opacity-90">{he.collectionEachSeparate}</p>

          {/* Quick jump to each course — makes "there is more than one" unmissable */}
          <nav className="mt-6 flex flex-wrap justify-center gap-2">
            {cards.map((c) => (
              <a
                key={c.id}
                href={`#course-${c.id}`}
                className="rounded-full border border-white/50 px-4 py-1.5 text-sm font-semibold hover:bg-white/10 transition-colors"
              >
                {c.emoji} {c.title}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {content.intro && (
        <section className="max-w-3xl mx-auto px-5 py-10 text-center text-base sm:text-lg leading-relaxed text-ink/80 whitespace-pre-line">
          {content.intro}
        </section>
      )}

      {/* Course cards */}
      <main className="max-w-5xl mx-auto px-5 pb-20 pt-6">
        <div className={`grid gap-6 ${cards.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {cards.map((c, i) => (
            <Reveal key={c.id} delay={i * 80}>
              <article
                id={`course-${c.id}`}
                className="h-full flex flex-col bg-card border border-line rounded-xl2 shadow-card overflow-hidden scroll-mt-6"
              >
                {c.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.coverUrl} alt="" className="w-full aspect-[16/9] object-cover" />
                ) : (
                  <div
                    className="w-full aspect-[16/9] flex items-center justify-center text-5xl"
                    style={{ background: theme.soft }}
                  >
                    {c.emoji}
                  </div>
                )}
                <div className="flex-1 flex flex-col p-5 sm:p-6">
                  <h2 className="font-display text-xl font-black leading-snug">{c.title}</h2>
                  {c.description && (
                    <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-4">{c.description}</p>
                  )}
                  {c.outcomes.length > 0 && (
                    <ul className="mt-4 space-y-1.5 text-sm">
                      {c.outcomes.map((o) => (
                        <li key={o} className="flex gap-2">
                          <span style={{ color: theme.main }} aria-hidden>
                            ✓
                          </span>
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(c.lessonCount > 0 || c.totalHours > 0) && (
                    <p className="mt-4 text-xs text-muted">
                      {c.lessonCount > 0 && `${c.lessonCount} ${he.lessons}`}
                      {c.lessonCount > 0 && c.totalHours > 0 && ' · '}
                      {c.totalHours > 0 && `${c.totalHours} ${he.hoursVideo}`}
                    </p>
                  )}

                  <div className="mt-auto pt-5">
                    {c.priceLabel && (
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="font-display text-2xl font-black">{c.priceLabel}</span>
                        {c.strikeLabel && (
                          <span className="text-sm text-muted line-through">{c.strikeLabel}</span>
                        )}
                      </div>
                    )}
                    {c.ctaHref ? (
                      <a
                        href={c.ctaHref}
                        className="block w-full text-center rounded-xl px-5 py-3 font-bold text-white shadow-cta transition-transform hover:-translate-y-0.5"
                        style={{ background: theme.accent }}
                      >
                        {c.ctaText}
                      </a>
                    ) : null}
                    {c.detailsHref && (
                      <Link
                        href={c.detailsHref}
                        className="block mt-2 text-center text-sm text-muted hover:text-ink underline"
                      >
                        {he.collectionToCourse}
                      </Link>
                    )}
                    {c.addons.length > 0 && (
                      <div className="mt-4 border-t border-line pt-3">
                        <p className="text-xs font-semibold text-muted mb-1.5">{he.collectionPickAnother}</p>
                        <ul className="space-y-1">
                          {c.addons.map((a) => (
                            <li key={a.id}>
                              <a
                                href={a.href}
                                className="text-sm font-medium hover:underline"
                                style={{ color: theme.main }}
                              >
                                + {a.title} · {a.priceLabel}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </main>

      <footer className="border-t border-line py-8 text-center text-xs text-muted">
        <SocialLinks socials={socials} className="justify-center mb-3" />
        <p>{tenantName}</p>
      </footer>
    </div>
  );
}
