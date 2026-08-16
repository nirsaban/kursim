import Link from 'next/link';
import { he } from '@/lib/he';
import { getPackages, PLAN_STUDENT_CAP } from '@/lib/billing';
import Icon, { type IconName } from '@/components/ui/Icon';
import LogoMark from '@/components/ui/LogoMark';
import { LeadForm } from './LeadForm';

/**
 * The platform's sales page. Marketing-led: the hero sells the outcome
 * (a school that sells for you), the grid shows the whole product, and
 * every road ends at the lead form. Security is one quiet trust section —
 * a reason to believe, not the headline.
 */
export function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <Nav />
      <Hero />
      <Stats />
      <Features />
      <How />
      <SaleFlow />
      <Pricing />
      <Trust />
      <Faq />
      <FinalCta />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <header className="border-b border-line bg-card/90 sticky top-0 z-20 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <LogoMark size={30} variant="ink" />
          <span className="font-display font-black text-lg text-ink">
            {he.appName}
            <span className="text-copper-500">.</span>
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-muted font-medium">
          <a href="#features" className="hover:text-ink transition-colors">{he.lpNavFeatures}</a>
          <a href="#how" className="hover:text-ink transition-colors">{he.lpNavHow}</a>
          <a href="#pricing" className="hover:text-ink transition-colors">{he.lpNavPricing}</a>
          <a href="#faq" className="hover:text-ink transition-colors">{he.lpNavFaq}</a>
        </nav>
        <Link
          href="/signup"
          className="inline-flex items-center bg-ink hover:bg-ink-surface text-card text-sm font-semibold rounded-xl px-4 min-h-[40px] transition-[background-color,transform] duration-150 active:scale-[0.98]"
        >
          {he.lpPricingCtaFree}
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="flex-1 flex items-center overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <div>
          <p className="kicker mb-3">{he.lpHeroKicker}</p>
          <h1 className="font-display text-4xl sm:text-5xl font-black leading-[1.12]">
            {he.lpHeroTitle1}
            <br />
            <span className="text-copper-600">{he.lpHeroTitle2}</span>
          </h1>
          <p className="text-muted text-lg mt-5 max-w-lg leading-relaxed">{he.lpHeroText}</p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-8">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center bg-copper-500 hover:bg-copper-600 text-card font-bold rounded-xl px-6 min-h-[52px] shadow-cta transition-[background-color,transform] duration-150 active:scale-[0.98]"
            >
              {he.lpPricingCtaFree}
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center justify-center border-[1.5px] border-line hover:border-brand-300 text-ink font-semibold rounded-xl px-6 min-h-[52px] transition-colors"
            >
              {he.lpNavCta}
            </a>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 mt-6 text-sm text-muted">
            {[he.lpHeroTrust1, he.lpHeroTrust2, he.lpHeroTrust3].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <Icon name="check" size={14} className="text-ok" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Product illustration: the owner dashboard, condensed */}
        <div className="hidden lg:block" aria-hidden>
          <div className="relative">
            <div className="absolute -inset-6 bg-paper rounded-[2rem] rotate-2 border border-line" />
            <div className="relative bg-card border border-line rounded-[1.5rem] shadow-lift p-6 space-y-5">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-ink">{he.lpDemoDashTitle}</span>
                <span className="inline-flex items-center gap-1.5 text-xs bg-ok-soft text-ok font-semibold rounded-full px-2.5 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-live" />
                  {he.lpDemoSaleBadge} · ₪490
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  [he.lpDemoStatStudents, '214'],
                  [he.lpDemoStatRevenue, '₪18,450'],
                  [he.lpDemoStatCompletion, '72%'],
                ].map(([label, value]) => (
                  <div key={label} className="bg-paper/70 border border-line rounded-xl p-3">
                    <p className="text-[11px] text-muted">{label}</p>
                    <p className="font-display font-black text-lg tabular-nums mt-1">{value}</p>
                  </div>
                ))}
              </div>
              <div className="border border-line rounded-xl p-3.5 flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-brand-100 grid place-items-center text-ink">
                  <Icon name="play" size={12} />
                </span>
                <div className="flex-1 space-y-1.5">
                  <div className="h-2 w-28 rounded-full bg-ink/15" />
                  <div className="h-2 w-20 rounded-full bg-ink/10" />
                </div>
                <span className="text-xs font-semibold text-muted">{he.lpDemoContinue}</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-muted border border-line rounded-xl px-3.5 py-2.5">
                <Icon name="chat" size={14} className="text-ok" />
                <span className="flex-1 truncate">{he.lpFlowStep3}</span>
                <Icon name="check" size={13} className="text-ok" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const STATS = [
  { valueKey: 'lpStat1Value', labelKey: 'lpStat1Label' },
  { valueKey: 'lpStat2Value', labelKey: 'lpStat2Label' },
  { valueKey: 'lpStat3Value', labelKey: 'lpStat3Label' },
  { valueKey: 'lpStat4Value', labelKey: 'lpStat4Label' },
] as const;

function Stats() {
  return (
    <section className="border-y border-line bg-card/60">
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
        {STATS.map((s) => (
          <div key={s.valueKey} className="text-center">
            <div className="font-display text-2xl sm:text-3xl font-black text-ink">{he[s.valueKey]}</div>
            <div className="text-xs sm:text-sm text-muted mt-1.5 leading-snug">{he[s.labelKey]}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-14">
      {eyebrow && <p className="kicker mb-3">{eyebrow}</p>}
      <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight">{title}</h2>
      {subtitle && <p className="text-muted text-lg mt-4">{subtitle}</p>}
    </div>
  );
}

const FEATURES: ReadonlyArray<{ icon: IconName; titleKey: keyof typeof he; bodyKey: keyof typeof he }> = [
  { icon: 'video', titleKey: 'lpFeatVideoTitle', bodyKey: 'lpFeatVideoBody' },
  { icon: 'trendingUp', titleKey: 'lpFeatLandingTitle', bodyKey: 'lpFeatLandingBody' },
  { icon: 'card', titleKey: 'lpFeatPayTitle', bodyKey: 'lpFeatPayBody' },
  { icon: 'chat', titleKey: 'lpFeatWhatsappTitle', bodyKey: 'lpFeatWhatsappBody' },
  { icon: 'users', titleKey: 'lpFeatStudentsTitle', bodyKey: 'lpFeatStudentsBody' },
  { icon: 'clock', titleKey: 'lpFeatAutomationTitle', bodyKey: 'lpFeatAutomationBody' },
  { icon: 'palette', titleKey: 'lpFeatBrandTitle', bodyKey: 'lpFeatBrandBody' },
  { icon: 'book', titleKey: 'lpFeatCommunityTitle', bodyKey: 'lpFeatCommunityBody' },
  { icon: 'award', titleKey: 'lpFeatGamifyTitle', bodyKey: 'lpFeatGamifyBody' },
  { icon: 'ticket', titleKey: 'lpFeatAffiliatesTitle', bodyKey: 'lpFeatAffiliatesBody' },
  { icon: 'bolt', titleKey: 'lpFeatApiTitle', bodyKey: 'lpFeatApiBody' },
  { icon: 'chart', titleKey: 'lpFeatAnalyticsTitle', bodyKey: 'lpFeatAnalyticsBody' },
];

function Features() {
  return (
    <section id="features" className="max-w-6xl mx-auto px-4 py-20 sm:py-24 scroll-mt-16">
      <SectionHead eyebrow={he.lpNavFeatures} title={he.lpFeaturesTitle} subtitle={he.lpFeaturesSubtitle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {FEATURES.map((f) => (
          <div
            key={f.titleKey}
            className="bg-card border border-line rounded-xl2 shadow-card p-5 sm:p-6 transition-[transform,box-shadow] duration-200 hover:shadow-lift hover:-translate-y-0.5"
          >
            <span className="w-10 h-10 rounded-xl bg-paper border border-line text-ink grid place-items-center mb-4">
              <Icon name={f.icon} size={18} />
            </span>
            <h3 className="font-display font-bold text-lg mb-1.5">{he[f.titleKey] as string}</h3>
            <p className="text-muted text-sm leading-relaxed">{he[f.bodyKey] as string}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { n: '01', titleKey: 'lpHowStep1Title', bodyKey: 'lpHowStep1Body' },
  { n: '02', titleKey: 'lpHowStep2Title', bodyKey: 'lpHowStep2Body' },
  { n: '03', titleKey: 'lpHowStep3Title', bodyKey: 'lpHowStep3Body' },
] as const;

function How() {
  return (
    <section id="how" className="bg-card/60 border-y border-line scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 py-20 sm:py-24">
        <SectionHead eyebrow={he.lpNavHow} title={he.lpHowTitle} subtitle={he.lpHowSubtitle} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="font-display text-5xl font-black text-line mb-4" aria-hidden>
                {s.n}
              </div>
              <h3 className="font-display text-xl font-bold mb-2">{he[s.titleKey]}</h3>
              <p className="text-muted leading-relaxed">{he[s.bodyKey]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FLOW_STEPS = ['lpFlowStep1', 'lpFlowStep2', 'lpFlowStep3', 'lpFlowStep4'] as const;

function SaleFlow() {
  return (
    <section className="max-w-3xl mx-auto px-4 py-20 sm:py-24">
      <SectionHead title={he.lpFlowTitle} subtitle={he.lpFlowSubtitle} />
      <ol className="relative border-s-2 border-line ms-4 space-y-8">
        {FLOW_STEPS.map((key, i) => (
          <li key={key} className="ms-8 relative">
            <span className="absolute -start-[41px] top-0 w-8 h-8 rounded-full bg-ink text-paper grid place-items-center font-display font-bold text-sm">
              {i + 1}
            </span>
            <p className="font-semibold text-ink leading-relaxed pt-1">{he[key]}</p>
          </li>
        ))}
      </ol>
      <p className="ms-12 mt-8 text-sm text-muted bg-paper/70 border border-line rounded-xl px-4 py-3 leading-relaxed">
        {he.lpFlowNote}
      </p>
    </section>
  );
}

const PLAN_NAMES: Record<string, string> = {
  STARTER: he.planStarter,
  GROWTH: he.planGrowth,
  UNLIMITED: he.planUnlimited,
};

const PLAN_DESCS: Record<string, string> = {
  STARTER: he.planStarterDesc,
  GROWTH: he.planGrowthDesc,
  UNLIMITED: he.planUnlimitedDesc,
};

function Pricing() {
  return (
    <section id="pricing" className="bg-card/60 border-y border-line scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 py-20 sm:py-24">
        <SectionHead eyebrow={he.lpNavPricing} title={he.lpPricingTitle} subtitle={he.lpPricingSubtitle} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 max-w-4xl mx-auto">
          {getPackages().map((p) => {
            const popular = p.plan === 'GROWTH';
            return (
              <div
                key={p.plan}
                className={
                  popular
                    ? 'relative bg-card border border-copper-300 rounded-xl2 shadow-lift p-6 flex flex-col'
                    : 'bg-card border border-line rounded-xl2 shadow-card p-6 flex flex-col'
                }
              >
                {popular && (
                  <span className="absolute -top-3 start-6 bg-copper-500 text-card text-xs font-bold rounded-full px-3 py-1">
                    {he.lpPricingPopular}
                  </span>
                )}
                <h3 className="font-display font-bold text-lg">{PLAN_NAMES[p.plan]}</h3>
                <p className="text-sm text-muted leading-relaxed mt-1 flex-1">{PLAN_DESCS[p.plan]}</p>
                <p className="mt-5">
                  <span className="font-display font-black text-3xl">{p.priceMonthly}</span>
                  <span className="text-sm text-muted ms-1.5">{he.planPerMonth}</span>
                </p>
                <p className="text-sm text-muted mt-1">
                  {p.cap === PLAN_STUDENT_CAP.UNLIMITED
                    ? he.planNoCap
                    : `${he.planUpTo} ${p.cap} ${he.planStudentsCap}`}
                </p>
                <Link
                  href="/signup"
                  className={
                    popular
                      ? 'mt-5 inline-flex items-center justify-center bg-copper-500 hover:bg-copper-600 text-card font-bold rounded-xl min-h-[48px] shadow-cta transition-[background-color,transform] duration-150 active:scale-[0.98]'
                      : 'mt-5 inline-flex items-center justify-center border-[1.5px] border-ink text-ink font-semibold rounded-xl min-h-[48px] hover:bg-paper transition-colors'
                  }
                >
                  {he.lpPricingCtaFree}
                </Link>
              </div>
            );
          })}
        </div>
        <p className="text-center text-sm text-muted mt-8">{he.lpPricingFreeNote}</p>
      </div>
    </section>
  );
}

const TRUST_POINTS = [
  { icon: 'shield', titleKey: 'lpTrust1Title', bodyKey: 'lpTrust1Body' },
  { icon: 'lock', titleKey: 'lpTrust2Title', bodyKey: 'lpTrust2Body' },
  { icon: 'check', titleKey: 'lpTrust3Title', bodyKey: 'lpTrust3Body' },
] as const;

function Trust() {
  return (
    <section className="bg-ink text-paper fx-grain">
      <div className="max-w-6xl mx-auto px-4 py-20 sm:py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight">{he.lpTrustTitle}</h2>
          <p className="text-paper/60 text-lg mt-4">{he.lpTrustSubtitle}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {TRUST_POINTS.map((p) => (
            <div key={p.titleKey} className="border border-paper/15 rounded-xl2 p-6">
              <span className="w-10 h-10 rounded-xl bg-paper/10 grid place-items-center mb-4">
                <Icon name={p.icon} size={18} />
              </span>
              <h3 className="font-display font-bold text-lg mb-1.5">{he[p.titleKey]}</h3>
              <p className="text-paper/60 text-sm leading-relaxed">{he[p.bodyKey]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  ['lpFaq1Q', 'lpFaq1A'],
  ['lpFaq2Q', 'lpFaq2A'],
  ['lpFaq3Q', 'lpFaq3A'],
  ['lpFaq4Q', 'lpFaq4A'],
  ['lpFaq5Q', 'lpFaq5A'],
] as const;

function Faq() {
  return (
    <section id="faq" className="max-w-2xl mx-auto px-4 py-20 sm:py-24 scroll-mt-16 w-full">
      <SectionHead title={he.lpFaqTitle} />
      <div className="space-y-3">
        {FAQS.map(([q, a]) => (
          <details
            key={q}
            className="group bg-card border border-line rounded-xl2 shadow-card open:shadow-lift transition-shadow"
          >
            <summary className="flex items-center justify-between gap-4 cursor-pointer select-none list-none px-5 py-4 font-semibold text-ink min-h-[52px] [&::-webkit-details-marker]:hidden">
              {he[q]}
              <span className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-180">
                <Icon name="arrowForward" size={15} className="-rotate-90" />
              </span>
            </summary>
            <p className="px-5 pb-5 text-muted leading-relaxed">{he[a]}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section id="contact" className="bg-brand-950 text-white scroll-mt-16">
      <div className="max-w-lg mx-auto px-4 py-20 sm:py-24 text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight">{he.lpFinalTitle}</h2>
        <p className="text-brand-200 text-lg mt-4">{he.lpFinalSubtitle}</p>
        <div className="mt-8 text-start">
          <LeadForm />
        </div>
        <p className="text-brand-300 text-sm mt-4">{he.platformFinalCtaNote}</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line py-8">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-muted">Kursim · {he.platformTagline}</p>
        <div className="flex items-center gap-5 text-xs text-muted">
          <Link href="/superadmin/login" className="hover:text-ink transition-colors">
            {he.platformCtaAdmin}
          </Link>
          <span>© {new Date().getFullYear()} Kursim · {he.platformFooterRights}</span>
        </div>
      </div>
    </footer>
  );
}
