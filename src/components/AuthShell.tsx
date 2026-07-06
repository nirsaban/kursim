/** Split-screen auth layout: brand panel + form. */
export default function AuthShell({
  title,
  subtitle,
  panelTitle,
  panelText,
  children,
}: {
  title: string;
  subtitle?: string;
  panelTitle: string;
  panelText: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen grid lg:grid-cols-[5fr,4fr]">
      <section className="flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <p className="kicker mb-2">Kursim</p>
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          {subtitle && <p className="text-muted mt-2">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </section>

      <aside
        className="hidden lg:flex flex-col justify-between p-12 bg-brand-950 text-white relative overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative">
          <span className="inline-flex w-12 h-12 rounded-2xl bg-white/10 items-center justify-center text-2xl">
            🎓
          </span>
        </div>
        <div className="relative">
          <h2 className="font-display text-4xl font-bold leading-tight max-w-md">
            {panelTitle}
          </h2>
          <p className="text-white/70 mt-4 max-w-md leading-relaxed">{panelText}</p>
        </div>
        <p className="relative text-white/40 text-sm">Kursim · פלטפורמת קורסים רב-ארגונית</p>
      </aside>
    </main>
  );
}
