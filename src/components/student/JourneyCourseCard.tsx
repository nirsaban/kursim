import Link from 'next/link';
import { LANDING_THEMES } from '@/lib/landing-themes';
import ProgressBar from '@/components/ui/ProgressBar';
import type { CourseJourney } from '@/lib/student-dashboard';
import { he } from '@/lib/he';

/**
 * One enrolled course as a "journey" card: accent-themed header, progress,
 * module milestone dots, and a continue CTA straight into the next lesson.
 */
export default function JourneyCourseCard({
  slug,
  course,
  index = 0,
}: {
  slug: string;
  course: CourseJourney;
  index?: number;
}) {
  const theme = LANDING_THEMES[course.accent];
  const done = course.pct === 100 && course.totalLessons > 0;

  return (
    <div
      className="group bg-card border border-line rounded-xl2 shadow-card hover:shadow-lift hover:-translate-y-1 transition-all duration-300 overflow-hidden animate-rise flex flex-col"
      style={{ animationDelay: `${Math.min(index, 5) * 80}ms` }}
    >
      <Link href={`/t/${slug}/course/${course.id}`} className="block">
        <div
          className="h-24 flex items-end p-4"
          style={{ background: `linear-gradient(to left, ${theme.deep}, ${theme.main})` }}
        >
          <span className="w-11 h-11 rounded-xl bg-card shadow-card flex items-center justify-center text-2xl translate-y-8">
            {course.emoji}
          </span>
        </div>
      </Link>
      <div className="p-5 pt-10 flex flex-col flex-1">
        <Link href={`/t/${slug}/course/${course.id}`}>
          <h2 className="font-display font-bold text-lg group-hover:opacity-80 transition-opacity">
            {course.title}
          </h2>
        </Link>
        {course.description && (
          <p className="text-sm text-muted line-clamp-2 mt-1">{course.description}</p>
        )}

        {/* Module milestones — the journey path */}
        {course.milestones.length > 0 && (
          <div className="flex items-center mt-4" aria-label={he.modules}>
            {course.milestones.slice(0, 8).map((m, i) => (
              <span key={i} className="flex items-center flex-1 last:flex-none">
                <span
                  title={`${m.title} · ${m.completedLessons}/${m.totalLessons}`}
                  className="w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors"
                  style={
                    m.done
                      ? { background: theme.main, borderColor: theme.main }
                      : m.completedLessons > 0
                        ? { background: theme.soft, borderColor: theme.main }
                        : { background: 'transparent', borderColor: '#E5E2DA' }
                  }
                />
                {i < Math.min(course.milestones.length, 8) - 1 && (
                  <span
                    className="h-0.5 flex-1 mx-1 rounded-full"
                    style={{ background: m.done ? theme.main : '#E5E2DA' }}
                  />
                )}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted mt-4 mb-2">
          <span>
            {course.completedLessons}/{course.totalLessons} {he.lessons}
          </span>
          <span className="font-semibold tabular-nums" style={{ color: theme.main }}>
            {course.pct}%
          </span>
        </div>
        <ProgressBar value={course.pct} tone={done ? 'ok' : 'brand'} />

        <div className="mt-4 pt-3 border-t border-line/70 flex items-center gap-2">
          {done ? (
            <span className="text-sm font-semibold text-ok">✓ {he.completed}</span>
          ) : course.nextLesson ? (
            <>
              <span className="text-xs text-muted truncate">
                {he.nextLessonLabel}: {course.nextLesson.title}
              </span>
              <Link
                href={`/t/${slug}/lesson/${course.nextLesson.id}`}
                className="ms-auto shrink-0 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-opacity hover:opacity-90"
                style={{ background: theme.main }}
              >
                ▶ {he.continueWatching}
              </Link>
            </>
          ) : (
            <span className="text-xs text-muted">{he.noLessons}</span>
          )}
        </div>
      </div>
    </div>
  );
}
