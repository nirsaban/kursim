import Link from 'next/link';
import { LANDING_THEMES } from '@/lib/landing-themes';
import ProgressBar from '@/components/ui/ProgressBar';
import Icon from '@/components/ui/Icon';
import Monogram from '@/components/ui/Monogram';
import type { CourseJourney } from '@/lib/student-dashboard';
import { he } from '@/lib/he';

/**
 * One enrolled course: monogram identity, module milestone dots, progress,
 * and a continue CTA straight into the next lesson. The course accent is a
 * quiet detail (milestones, percentage) — never a painted header.
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
      className="group bg-card border border-line rounded-xl2 shadow-card hover:shadow-lift hover:-translate-y-0.5 transition-[transform,box-shadow] duration-200 animate-rise flex flex-col p-5"
      style={{ animationDelay: `${Math.min(index, 5) * 60}ms` }}
    >
      <Link href={`/t/${slug}/course/${course.id}`} className="flex items-start gap-3.5">
        <Monogram name={course.title} size="lg" tint={theme.soft} ink={theme.deep} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-bold text-lg leading-snug group-hover:text-brand-700 transition-colors">
            {course.title}
          </h2>
          {course.description && (
            <p className="text-sm text-muted line-clamp-2 mt-1 leading-relaxed">
              {course.description}
            </p>
          )}
        </div>
      </Link>

      {/* Module milestones — the journey path */}
      {course.milestones.length > 0 && (
        <div className="flex items-center mt-5" aria-label={he.modules}>
          {course.milestones.slice(0, 8).map((m, i) => (
            <span key={i} className="flex items-center flex-1 last:flex-none">
              <span
                title={`${m.title} · ${m.completedLessons}/${m.totalLessons}`}
                className="w-3 h-3 rounded-full border-2 shrink-0"
                style={
                  m.done
                    ? { background: theme.main, borderColor: theme.main }
                    : m.completedLessons > 0
                      ? { background: theme.soft, borderColor: theme.main }
                      : { background: 'transparent', borderColor: '#E5E0D4' }
                }
              />
              {i < Math.min(course.milestones.length, 8) - 1 && (
                <span
                  className="h-px flex-1 mx-1"
                  style={{ background: m.done ? theme.main : '#E5E0D4' }}
                />
              )}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-baseline justify-between text-xs text-muted mt-5 mb-2">
        <span className="tabular-nums">
          {course.completedLessons}/{course.totalLessons} {he.lessons}
        </span>
        <span className="font-semibold tabular-nums text-ink">{course.pct}%</span>
      </div>
      <ProgressBar value={course.pct} tone={done ? 'ok' : 'brand'} />

      <div className="mt-4 pt-4 border-t border-line/70 flex items-center gap-3 min-h-[44px]">
        {done ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok">
            <Icon name="check" size={15} />
            {he.completed}
          </span>
        ) : course.nextLesson ? (
          <>
            <span className="text-xs text-muted truncate leading-relaxed">
              {he.nextLessonLabel}: {course.nextLesson.title}
            </span>
            <Link
              href={`/t/${slug}/lesson/${course.nextLesson.id}`}
              className="ms-auto shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-ink border-[1.5px] border-ink rounded-lg px-3.5 py-1.5 min-h-[36px] transition-[background-color,transform] duration-150 hover:bg-paper active:scale-[0.98]"
            >
              <Icon name="play" size={12} />
              {he.continueWatching}
            </Link>
          </>
        ) : (
          <span className="text-xs text-muted">{he.noLessons}</span>
        )}
      </div>
    </div>
  );
}
