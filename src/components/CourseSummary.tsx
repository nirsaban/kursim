import { he } from '@/lib/he';

interface SummaryModule {
  id: string;
  title: string;
  lessons: Array<{ id: string; title: string; notes: string | null }>;
}

/** First meaningful line of the lesson notes, trimmed to a bullet-sized snippet. */
function noteSnippet(notes: string | null): string | null {
  if (!notes) return null;
  const line = notes
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return null;
  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
}

/**
 * Shown when a student completes the course: a recap of what was covered,
 * built from each lesson's title and description.
 */
export default function CourseSummary({ modules }: { modules: SummaryModule[] }) {
  const withLessons = modules.filter((m) => m.lessons.length > 0);
  if (withLessons.length === 0) return null;

  return (
    <section className="bg-gradient-to-l from-brand-800 to-brand-600 text-white rounded-xl2 shadow-lift overflow-hidden">
      <div className="p-6 pb-4">
        <h2 className="font-display text-2xl font-bold">{he.courseCompletedTitle}</h2>
        <p className="text-white/75 mt-1">{he.courseCompletedSub}</p>
      </div>
      <div className="bg-white/10 backdrop-blur px-6 py-5">
        <p className="kicker !text-white/60 mb-4">{he.whatWeLearned}</p>
        <div className="grid gap-5 sm:grid-cols-2">
          {withLessons.map((mod, mi) => (
            <div key={mod.id}>
              <h3 className="font-display font-bold flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-white/20 text-xs flex items-center justify-center shrink-0">
                  {mi + 1}
                </span>
                {mod.title}
              </h3>
              <ul className="mt-2.5 space-y-1.5">
                {mod.lessons.map((lesson) => {
                  const snippet = noteSnippet(lesson.notes);
                  return (
                    <li key={lesson.id} className="flex items-start gap-2 text-sm">
                      <span className="text-white/60 mt-0.5 shrink-0" aria-hidden>
                        ✓
                      </span>
                      <span>
                        <span className="font-semibold">{lesson.title}</span>
                        {snippet && (
                          <span className="block text-white/70 leading-relaxed">{snippet}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
