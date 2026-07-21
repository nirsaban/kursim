import LogoMark from '@/components/ui/LogoMark';
import SeatDots from '@/components/ui/SeatDots';
import TiltCard from '@/components/fx/TiltCard';
import Aurora from '@/components/fx/Aurora';
import { he } from '@/lib/he';

/**
 * Auth layout: top nav + footer on every viewport, split brand panel on
 * desktop, and a compact aurora hero on mobile so small screens get the
 * brand moment too.
 */
export default function AuthShell({
  orgName,
  orgSubtitle,
  title,
  subtitle,
  panelTitle,
  panelText,
  children,
}: {
  orgName?: string;
  orgSubtitle?: string;
  title: string;
  subtitle?: string;
  panelTitle: string;
  panelText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-card">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-line bg-card/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <LogoMark size={28} variant="ink" />
            <span className="font-display font-black text-lg text-ink">
              {he.appName}
              <span className="text-copper-500">.</span>
            </span>
          </div>
          {orgName && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-ink truncate">{orgName}</span>
              <span className="w-8 h-8 rounded-lg bg-ink text-paper grid place-items-center font-display font-black text-sm shrink-0">
                {orgName.charAt(0)}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[5fr,4fr]">
        <section className="flex flex-col items-center justify-start lg:justify-center p-6 sm:p-10">
          {/* Mobile brand hero — the dark panel moment, condensed */}
          <div className="lg:hidden w-full max-w-sm relative overflow-hidden rounded-xl2 bg-ink text-paper px-6 py-6 mb-8 fx-grain animate-rise">
            <Aurora />
            <div className="relative">
              <SeatDots seats={['active', 'occupied', 'free']} size="sm" dark className="mb-3" />
              <p className="font-display font-bold text-lg leading-snug">{panelTitle}</p>
            </div>
          </div>

          <div className="w-full max-w-sm">
            {orgName ? (
              <div className="hidden lg:flex items-center gap-3 mb-8 animate-rise">
                <div className="w-11 h-11 rounded-xl bg-ink text-paper grid place-items-center font-display font-black text-xl">
                  {orgName.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-ink">{orgName}</div>
                  {orgSubtitle && <div className="text-xs text-muted">{orgSubtitle}</div>}
                </div>
              </div>
            ) : (
              <p className="kicker mb-2 animate-rise">{he.appName}</p>
            )}
            <h1 className="font-display text-3xl font-black animate-rise rise-1">{title}</h1>
            {subtitle && <p className="text-muted mt-2 animate-rise rise-2">{subtitle}</p>}
            <div className="mt-8 animate-rise rise-3">{children}</div>
          </div>
        </section>

        {/* Desktop brand panel */}
        <aside
          className="hidden lg:flex flex-col justify-between p-12 bg-ink text-paper relative overflow-hidden fx-grain"
          aria-hidden
        >
          <Aurora />
          <div className="relative flex items-center gap-2.5">
            <LogoMark size={34} variant="bone" />
            <span className="font-display font-black text-xl">
              {he.appName}
              <span className="text-copper-500">.</span>
            </span>
          </div>

          {/* Floating 3D session cards — abstract, decorative */}
          <div className="relative fx-stage self-center w-full max-w-xs">
            <div className="animate-float">
              <TiltCard maxTilt={10} className="rounded-2xl">
                <div className="rounded-2xl bg-ink-surface/90 border border-paper/10 px-5 py-4 shadow-modal backdrop-blur">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl bg-paper/10 grid place-items-center">
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
                </div>
              </TiltCard>
            </div>
            <div className="absolute -bottom-10 -start-8 w-40 animate-float-slow">
              <div className="rounded-xl bg-ink-surface/80 border border-paper/10 px-4 py-3 shadow-lift backdrop-blur">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-coin animate-pulse-amber" />
                  <div className="h-2 flex-1 rounded-full bg-paper/15" />
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
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
            Kursim · {he.platformTagline}
          </p>
          <SeatDots seats={['occupied', 'occupied', 'free']} size="sm" />
        </div>
      </footer>
    </div>
  );
}
