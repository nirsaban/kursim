import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-white/90">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-lg">
              🎓
            </span>
            <span className="font-display font-bold text-lg">Kursim</span>
          </div>
          <Link
            href="/superadmin/login"
            className="text-sm text-muted hover:text-ink font-medium"
          >
            ניהול מערכת
          </Link>
        </div>
      </header>

      <section className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-4 py-20 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="kicker mb-3">פלטפורמת קורסים רב-ארגונית</p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold leading-[1.15]">
              בית ספר דיגיטלי משלכם,
              <br />
              <span className="text-brand-700">בלי לשתף סיסמאות</span>
            </h1>
            <p className="text-muted text-lg mt-5 max-w-lg leading-relaxed">
              העלאת שיעורי וידאו, ניהול תלמידים ודפי נחיתה משווקים — עם הגבלת מכשירים
              חכמה שמגינה על התוכן שלכם.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/superadmin/login"
                className="inline-flex items-center bg-brand-700 hover:bg-brand-800 text-white font-semibold rounded-xl px-6 py-3 transition-colors"
              >
                כניסת מנהל המערכת
              </Link>
            </div>
            <p className="text-sm text-muted mt-4">
              תלמידים ובעלי קורסים נכנסים דרך הכתובת של בית הספר שלהם: ‎/t/שם-בית-הספר
            </p>
          </div>

          <div className="hidden lg:block" aria-hidden>
            <div className="relative">
              <div className="absolute -inset-6 bg-brand-100/60 rounded-[2rem] rotate-2" />
              <div className="relative bg-white border border-line rounded-[1.5rem] shadow-lift p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
                      📈
                    </span>
                    <span className="font-semibold text-sm">מי מחובר עכשיו</span>
                  </div>
                  <span className="text-xs bg-ok/10 text-ok font-semibold rounded-full px-2.5 py-1">
                    3 חיבורים
                  </span>
                </div>
                {[
                  ['dana@school.co.il', 'Chrome · Mac', 'עכשיו'],
                  ['yossi@gmail.com', 'Safari · iOS', 'לפני דקה'],
                  ['maya@outlook.com', 'Chrome · Windows', 'לפני 4 דקות'],
                ].map(([mail, device, time]) => (
                  <div
                    key={mail}
                    className="flex items-center justify-between text-sm border-b border-line/60 pb-3 last:border-0 last:pb-0"
                  >
                    <span dir="ltr" className="text-ink">{mail}</span>
                    <span className="text-muted text-xs">{device}</span>
                    <span className="text-muted text-xs">{time}</span>
                  </div>
                ))}
                <div className="rounded-xl bg-warn/10 border border-warn/20 px-4 py-2.5 text-xs font-medium text-warn">
                  מכשיר רביעי נחסם — חריגה ממגבלת המכשירים
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-6">
        <p className="text-center text-sm text-muted">Kursim · נבנה לבתי ספר דיגיטליים</p>
      </footer>
    </main>
  );
}
