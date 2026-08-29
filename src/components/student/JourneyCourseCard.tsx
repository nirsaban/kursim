import Link from 'next/link';
import { LANDING_THEMES } from '@/lib/landing-themes';
import ProgressBar from '@/components/ui/ProgressBar';
import Icon from '@/components/ui/Icon';
import type { CourseJourney } from '@/lib/student-dashboard';
import { he } from '@/lib/he';

/**
 * "My learning" course card: thumbnail, title, school name, thin progress
 * bar with a percentage — opens straight into the lecture to watch next.
 */
export default function JourneyCourseCard({
  slug,
  course,
  coverUrl,
  schoolName,
}: {
  slug: string;
  course: CourseJourney;
  coverUrl?: string | null;
  schoolName: string;
}) {
  const theme = LANDING_THEMES[course.accent];
  const done = course.pct === 100 && course.totalLessons > 0;
  const href = course.nextLesson ? `/t/${slug}/lesson/${course.nextLesson.id}` : `/t/${slug}/course/${course.id}`;

  return (
    <Link href={href} className="group block border border-line rounded-lg bg-card hover:shadow-lift transition-shadow">
      <div className="relative aspect-video border-b border-line overflow-hidden rounded-t-lg" style={{ background: theme.soft }}>
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <span className="text-5xl" aria-hidden>
              {course.emoji}
            </span>
          </div>
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/30 transition-colors">
          <span className="w-12 h-12 rounded-full bg-white/90 text-ink grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Icon name="play" size={18} />
          </span>
        </span>
      </div>
      <div className="p-3">
        <h2 className="font-body font-bold text-base leading-snug line-clamp-2 text-ink">{course.title}</h2>
        <p className="text-xs text-muted mt-1 truncate">{schoolName}</p>
        <div className="mt-3">
          <ProgressBar value={course.pct} tone={done ? 'ok' : 'brand'} className="h-1" />
          <div className="flex items-center justify-between mt-1.5 text-xs">
            <span className="text-muted tabular-nums">
              {course.totalLessons === 0
                ? he.noLessons
                : course.completedLessons === 0
                  ? he.myLearningStart
                  : he.myLearningPct.replace('{pct}', String(course.pct))}
            </span>
            {done && (
              <span className="inline-flex items-center gap-1 font-bold text-ok">
                <Icon name="check" size={12} />
                {he.completed}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
