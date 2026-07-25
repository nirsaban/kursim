import Link from "next/link";
import { he } from "@/lib/he";

export function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <Nav />
      <Hero />
      <Stats />
      <How />
      <Features />
      <Security />
      <FinalCta />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <header className="border-b border-line bg-card/90 sticky top-0 z-20 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-lg">
            🎓
          </span>
          <span className="font-display font-bold text-lg">Kursim</span>
        </div>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-muted font-medium">
          <a href="#how" className="hover:text-ink transition-colors">{he.platformNavHow}</a>
          <a href="#features" className="hover:text-ink transition-colors">{he.platformNavFeatures}</a>
          <a href="#security" className="hover:text-ink transition-colors">{he.platformNavSecurity}</a>
        </nav>
        <Link href="/superadmin/login" className="text-sm text-muted hover:text-ink font-medium">
          {he.platformCtaAdmin}
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="flex-1 flex items-center">
      <div className="max-w-6xl mx-auto px-4 py-20 grid lg:grid-cols-2 gap-14 items-center">
        <div>
          <p className="kicker mb-3">{he.platformTagline}</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold leading-[1.15]">
            {he.platformHeroTitle1}
            <br />
            <span className="text-brand-700">{he.platformHeroTitle2}</span>
          </h1>
          <p className="text-muted text-lg mt-5 max-w-lg leading-relaxed">{he.platformHeroText}</p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              href="/superadmin/login"
              className="inline-flex items-center bg-brand-700 hover:bg-brand-800 text-white font-semibold rounded-xl px-6 py-3 transition-colors"
            >
              {he.platformCtaAdmin}
            </Link>
            <a
              href="#features"
              className="inline-flex items-center border border-line hover:border-brand-300 text-ink font-semibold rounded-xl px-6 py-3 transition-colors"
            >
              {he.platformNavFeatures}
            </a>
          </div>
          <p className="text-sm text-muted mt-4">{he.platformTenantHint}</p>
        </div>

        <div className="hidden lg:block" aria-hidden>
          <div className="relative">
            <div className="absolute -inset-6 bg-brand-100/60 rounded-[2rem] rotate-2" />
            <div className="relative bg-card border border-line rounded-[1.5rem] shadow-lift p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">📈</span>
                  <span className="font-semibold text-sm">{he.whoIsWatching}</span>
                </div>
                <span className="text-xs bg-ok/10 text-ok font-semibold rounded-full px-2.5 py-1">
                  {he.platformDemoConnections}
                </span>
              </div>
              {[
                ["dana@school.co.il", "Chrome · Mac", he.platformDemoNow],
                ["yossi@gmail.com", "Safari · iOS", he.platformDemoAgoMin],
                ["maya@outlook.com", "Chrome · Windows", he.platformDemoAgo4Min],
              ].map(([mail, device, time]) => (
                <div key={mail} className="flex items-center justify-between text-sm border-b border-line/60 pb-3 last:border-0 last:pb-0">
                  <span dir="ltr" className="text-ink">{mail}</span>
                  <span className="text-muted text-xs">{device}</span>
                  <span className="text-muted text-xs">{time}</span>
                </div>
              ))}
              <div className="rounded-xl bg-warn/10 border border-warn/20 px-4 py-2.5 text-xs font-medium text-warn">
                {he.platformDemoBlocked}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const STATS = [
  { valueKey: "platformStat1Value", labelKey: "platformStat1Label" },
  { valueKey: "platformStat2Value", labelKey: "platformStat2Label" },
  { valueKey: "platformStat3Value", labelKey: "platformStat3Label" },
  { valueKey: "platformStat4Value", labelKey: "platformStat4Label" },
] as const;

function Stats() {
  return (
    <section className="border-y border-line bg-card/60">
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
        {STATS.map((s) => (
          <div key={s.valueKey} className="text-center">
            <div className="font-display text-2xl sm:text-3xl font-bold text-brand-700">{he[s.valueKey]}</div>
            <div className="text-xs sm:text-sm text-muted mt-1.5 leading-snug">{he[s.labelKey]}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-14">
      <p className="kicker mb-3">{eyebrow}</p>
      <h2 className="font-display text-3xl sm:text-4xl font-bold leading-tight">{title}</h2>
      {subtitle && <p className="text-muted text-lg mt-4">{subtitle}</p>}
    </div>
  );
}

const STEPS = [
  { n: "01", titleKey: "platformStep1Title", bodyKey: "platformStep1Body" },
  { n: "02", titleKey: "platformStep2Title", bodyKey: "platformStep2Body" },
  { n: "03", titleKey: "platformStep3Title", bodyKey: "platformStep3Body" },
] as const;

function How() {
  return (
    <section id="how" className="max-w-6xl mx-auto px-4 py-24">
      <SectionHead eyebrow={he.platformHowEyebrow} title={he.platformHowTitle} subtitle={he.platformHowSubtitle} />
      <div className="grid sm:grid-cols-3 gap-8">
        {STEPS.map((s) => (
          <div key={s.n} className="relative">
            <div className="font-display text-5xl font-bold text-brand-100 mb-4">{s.n}</div>
            <h3 className="font-display text-xl font-bold mb-2">{he[s.titleKey]}</h3>
            <p className="text-muted leading-relaxed">{he[s.bodyKey]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: "🛡️", titleKey: "platformFeature1Title", bodyKey: "platformFeature1Body" },
  { icon: "⚡", titleKey: "platformFeature2Title", bodyKey: "platformFeature2Body" },
  { icon: "📣", titleKey: "platformFeature3Title", bodyKey: "platformFeature3Body" },
  { icon: "👥", titleKey: "platformFeature4Title", bodyKey: "platformFeature4Body" },
  { icon: "🔔", titleKey: "platformFeature5Title", bodyKey: "platformFeature5Body" },
  { icon: "💬", titleKey: "platformFeature6Title", bodyKey: "platformFeature6Body" },
] as const;

function Features() {
  return (
    <section id="features" className="bg-card/60 border-y border-line">
      <div className="max-w-6xl mx-auto px-4 py-24">
        <SectionHead eyebrow={he.platformNavFeatures} title={he.platformFeaturesTitle} subtitle={he.platformFeaturesSubtitle} />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.titleKey} className="bg-card border border-line rounded-2xl p-6">
              <span className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-lg mb-4">{f.icon}</span>
              <h3 className="font-display font-bold text-lg mb-2">{he[f.titleKey]}</h3>
              <p className="text-muted text-sm leading-relaxed">{he[f.bodyKey]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const SECURITY_POINTS = [
  { titleKey: "platformSecurity1Title", bodyKey: "platformSecurity1Body" },
  { titleKey: "platformSecurity2Title", bodyKey: "platformSecurity2Body" },
  { titleKey: "platformSecurity3Title", bodyKey: "platformSecurity3Body" },
] as const;

function Security() {
  return (
    <section id="security" className="max-w-5xl mx-auto px-4 py-24">
      <SectionHead eyebrow={he.platformNavSecurity} title={he.platformSecurityTitle} subtitle={he.platformSecuritySubtitle} />
      <div className="space-y-6">
        {SECURITY_POINTS.map((p, i) => (
          <div key={p.titleKey} className="flex gap-5 items-start bg-card border border-line rounded-2xl p-6">
            <span className="shrink-0 w-9 h-9 rounded-full bg-copper-100 text-copper-700 font-display font-bold flex items-center justify-center text-sm">
              {i + 1}
            </span>
            <div>
              <h3 className="font-display font-bold text-lg mb-1.5">{he[p.titleKey]}</h3>
              <p className="text-muted leading-relaxed">{he[p.bodyKey]}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-brand-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-bold leading-tight">{he.platformFinalCtaTitle}</h2>
        <p className="text-brand-200 text-lg mt-4">{he.platformFinalCtaSubtitle}</p>
        <a
          href="mailto:hello@kursim.miltech.cloud"
          className="inline-flex items-center bg-copper-500 hover:bg-copper-600 text-white font-semibold rounded-xl px-7 py-3.5 mt-8 transition-colors"
        >
          {he.platformFinalCtaButton}
        </a>
        <p className="text-brand-300 text-sm mt-4">{he.platformFinalCtaNote}</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line py-8">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-muted">Kursim · {he.platformFooterTagline}</p>
        <p className="text-xs text-muted">© {new Date().getFullYear()} Kursim · {he.platformFooterRights}</p>
      </div>
    </footer>
  );
}
