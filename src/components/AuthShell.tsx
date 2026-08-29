import LogoMark from '@/components/ui/LogoMark';
import SeatDots from '@/components/ui/SeatDots';
import { he } from '@/lib/he';
import { BRAND } from '@/lib/brand';

/**
 * Auth layout: top nav + footer on every viewport, split brand panel on
 * desktop, and a compact flat dark hero on mobile so small screens get the
 * brand moment too.
 */
export default function AuthShell({
  orgName,
  orgSubtitle,
  orgLogoUrl,
  title,
  subtitle,
  panelTitle,
  panelText,
  children,
}: {
  orgName?: string;
  orgSubtitle?: string;
  /** Tenant logo from the branding studio; replaces the initial-letter tile. */
  orgLogoUrl?: string;
  title: string;
  subtitle?: string;
  panelTitle: string;
  panelText: string;
  children: React.ReactNode;
}) {
  const orgTile = (size: string, text: string) =>
    orgLogoUrl ? (
      <span className={`${size} rounded-xl bg-paper border border-line grid place-items-center overflow-hidden shrink-0`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={orgLogoUrl} alt="" className="max-w-full max-h-full object-contain" />
      </span>
    ) : (
      <span
        className={`${size} rounded-xl bg-ink text-paper grid place-items-center font-display font-bold ${text} shrink-0`}
      >
        {orgName?.charAt(0)}
      </span>
    );
  return (
    <div className="min-h-screen flex flex-col bg-card">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-line bg-card/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <LogoMark size={28} variant="ink" />
            <span className="font-display font-bold text-lg text-ink">
              {he.appName}
              <span className="text-copper-500">.</span>
            </span>
          </div>
          {orgName && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-ink truncate">{orgName}</span>
              {orgTile('w-8 h-8', 'text-sm')}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[5fr,4fr]">
        <section className="flex flex-col items-center justify-start lg:justify-center p-6 sm:p-10">
          {/* Mobile brand hero — the dark panel moment, condensed */}
          <div className="lg:hidden w-full max-w-sm rounded-xl2 bg-ink text-paper px-6 py-6 mb-8 animate-rise">
            <SeatDots seats={['active', 'occupied', 'free']} size="sm" dark className="mb-3" />
            <p className="font-display font-bold text-lg leading-snug">{panelTitle}</p>
          </div>

          <div className="w-full max-w-sm">
            {orgName ? (
              <div className="hidden lg:flex items-center gap-3 mb-8 animate-rise">
                {orgTile('w-11 h-11', 'text-xl')}
                <div>
                  <div className="font-bold text-ink">{orgName}</div>
                  {orgSubtitle && <div className="text-xs text-muted">{orgSubtitle}</div>}
                </div>
              </div>
            ) : (
              <p className="kicker mb-2 animate-rise">{he.appName}</p>
            )}
            <h1 className="font-display text-3xl font-bold animate-rise rise-1">{title}</h1>
            {subtitle && <p className="text-muted mt-2 animate-rise rise-2">{subtitle}</p>}
            <div className="mt-8 animate-rise rise-3 rounded-xl2 border border-line bg-card shadow-card p-6 sm:p-7">
              {children}
            </div>
          </div>
        </section>

        {/* Desktop brand panel — flat dark surface, no glow/grain/3D-float */}
        <aside className="hidden lg:flex flex-col justify-between p-12 bg-ink text-paper" aria-hidden>
          <div className="flex items-center gap-2.5">
            <LogoMark size={34} variant="bone" />
            <span className="font-display font-bold text-xl">
              {he.appName}
              <span className="text-copper-500">.</span>
            </span>
          </div>

          {/* Flat mock card — the device-session motif, static (no tilt/glare) */}
          <div className="self-center w-full max-w-xs rounded-2xl border border-brand-700 bg-brand-800 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-brand-700 grid place-items-center">
                <LogoMark size={22} variant="vermilion" />
              </span>
              <div className="flex-1 space-y-1.5">
                <div className="h-2 w-24 rounded-full bg-paper/25" />
                <div className="h-2 w-16 rounded-full bg-paper/10" />
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-live animate-pulse-live" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <SeatDots seats={['active', 'occupied', 'free']} size="sm" dark />
              <div className="h-2 w-12 rounded-full bg-paper/10" />
            </div>
            <div className="mt-3.5 pt-3.5 border-t border-brand-700 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-coin animate-pulse-amber" />
              <div className="h-2 flex-1 rounded-full bg-paper/15" />
            </div>
          </div>

          <div>
            <SeatDots seats={['active', 'occupied', 'free']} size="md" dark className="mb-4" />
            <h2 className="font-display text-3xl font-bold leading-snug max-w-md">{panelTitle}</h2>
            <p className="text-brand-300 mt-3 max-w-md leading-relaxed text-sm">{panelText}</p>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-card">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {BRAND.name} · {he.platformTagline}
          </p>
          <SeatDots seats={['occupied', 'occupied', 'free']} size="sm" />
        </div>
      </footer>
    </div>
  );
}
