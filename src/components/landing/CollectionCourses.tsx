import Link from 'next/link';
import type { LandingCollection } from '@/components/landing/landing-types';
import type { LandingTheme } from '@/lib/landing-themes';
import Reveal from '@/components/landing/Reveal';
import SectionHeading from '@/components/landing/SectionHeading';
import { he } from '@/lib/he';

/**
 * The course picker on a combined landing page. Rendered by both templates
 * near the top of the page so "this school sells several courses" is
 * unmissable; every card leads to that course's own checkout.
 */
export default function CollectionCourses({
  collection,
  theme,
  variant,
}: {
  collection: LandingCollection;
  theme: LandingTheme;
  variant: 'classic' | 'coral';
}) {
  const coral = variant === 'coral';
  const border = 'border-line';
  const muted = 'text-muted';
  const titleFont = coral ? 'font-body font-extrabold' : 'font-display font-bold';
  const cols = collection.courses.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';

  return (
    <section id="courses" className={`max-w-5xl mx-auto px-4 py-16 scroll-mt-20 border-t ${border}`}>
      <Reveal>
        <SectionHeading
          title={collection.title}
          subtitle={collection.subtitle}
          accent={theme.accent}
          titleClassName={titleFont}
          className="mb-10"
        />
      </Reveal>
      <div className={`grid grid-cols-1 gap-6 ${cols}`}>
        {collection.courses.map((c, i) => (
          <Reveal key={c.id} delay={i * 80} className="h-full">
            <article
              className={`h-full flex flex-col rounded-lg overflow-hidden border ${border} bg-card transition-colors duration-300 hover:border-[--hover-line]`}
              style={{ '--hover-line': theme.main } as React.CSSProperties}
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
              <div className="flex-1 flex flex-col p-6">
                {c.isFront && (
                  <span
                    className="self-start text-[11px] font-bold rounded-full px-2.5 py-1 mb-3 text-card"
                    style={{ background: theme.main }}
                  >
                    {he.collectionFrontBadge}
                  </span>
                )}
                <h3 className={`${titleFont} text-xl leading-snug`}>{c.title}</h3>
                {c.description && (
                  <p className={`mt-2 text-sm leading-relaxed line-clamp-4 ${muted}`}>{c.description}</p>
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
                {(c.lessonCount > 0 || c.totalHours) && (
                  <p className={`mt-4 text-xs ${muted}`}>
                    {c.lessonCount > 0 && `${c.lessonCount} ${he.lessons}`}
                    {c.lessonCount > 0 && c.totalHours && ' · '}
                    {c.totalHours && `${c.totalHours} ${he.hoursVideo}`}
                  </p>
                )}

                <div className="mt-auto pt-5">
                  {c.priceLabel && (
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className={`${titleFont} text-2xl`}>{c.priceLabel}</span>
                      {c.strikeLabel && (
                        <span className={`text-sm line-through ${muted}`}>{c.strikeLabel}</span>
                      )}
                    </div>
                  )}
                  {c.ctaHref && (
                    <a
                      href={c.ctaHref}
                      className="group inline-flex w-full items-center justify-center gap-2 font-bold rounded-lg px-6 py-3.5 text-card transition-opacity hover:opacity-90"
                      style={{ background: theme.main }}
                    >
                      <span aria-hidden>🔒</span>
                      {c.ctaText}
                      <span aria-hidden>←</span>
                    </a>
                  )}
                  {c.detailsHref && (
                    <Link href={c.detailsHref} className={`block mt-2 text-center text-sm underline ${muted}`}>
                      {he.collectionToCourse}
                    </Link>
                  )}
                  {c.addons.length > 0 && (
                    <div className={`mt-4 border-t ${border} pt-3`}>
                      <p className={`text-xs font-semibold mb-1.5 ${muted}`}>{he.collectionPickAnother}</p>
                      <ul className="space-y-1">
                        {c.addons.map((a) => (
                          <li key={a.id}>
                            <a href={a.href} className="text-sm font-medium hover:underline" style={{ color: theme.main }}>
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
    </section>
  );
}
