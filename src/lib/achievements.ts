import type { HeKey } from '@/lib/he';

/**
 * Pure helpers for the student journey: day bucketing (Asia/Jerusalem),
 * learning streaks, computed achievements, and time-of-day greeting.
 * All strings stay in he.ts — this file only names keys.
 */

const TIME_ZONE = 'Asia/Jerusalem';

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** yyyy-mm-dd calendar day in Asia/Jerusalem. The single source of day math. */
export function dayKey(d: Date): string {
  return dayFmt.format(d);
}

/** Hour (0-23) in Asia/Jerusalem. */
export function jerusalemHour(d: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hour12: false })
      .format(d)
      .slice(0, 2),
  );
}

/** The calendar day before a yyyy-mm-dd key (pure calendar math, no TZ). */
export function prevDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d) - 86_400_000);
  return prev.toISOString().slice(0, 10);
}

/**
 * Consecutive active days ending today or yesterday — a streak only breaks
 * once a full calendar day passes with no activity.
 */
export function computeStreak(activeDayKeys: Iterable<string>, today: Date): number {
  const active = new Set(activeDayKeys);
  let cursor = dayKey(today);
  if (!active.has(cursor)) cursor = prevDayKey(cursor);
  let streak = 0;
  while (active.has(cursor)) {
    streak += 1;
    cursor = prevDayKey(cursor);
  }
  return streak;
}

export type Achievement = {
  id: string;
  icon: string;
  titleKey: HeKey;
  descKey: HeKey;
  unlocked: boolean;
};

export type AchievementInput = {
  completedLessons: number;
  completedCourses: number;
  streak: number;
};

/** All badges in display order; unlocked is derived from the student's totals. */
export function computeAchievements(input: AchievementInput): Achievement[] {
  const { completedLessons, completedCourses, streak } = input;
  return [
    { id: 'first-lesson', icon: '🌱', titleKey: 'achFirstLesson', descKey: 'achFirstLessonDesc', unlocked: completedLessons >= 1 },
    { id: 'lessons-5', icon: '⚡', titleKey: 'achLessons5', descKey: 'achLessons5Desc', unlocked: completedLessons >= 5 },
    { id: 'lessons-10', icon: '🚀', titleKey: 'achLessons10', descKey: 'achLessons10Desc', unlocked: completedLessons >= 10 },
    { id: 'lessons-25', icon: '🏔️', titleKey: 'achLessons25', descKey: 'achLessons25Desc', unlocked: completedLessons >= 25 },
    { id: 'first-course', icon: '🏁', titleKey: 'achFirstCourse', descKey: 'achFirstCourseDesc', unlocked: completedCourses >= 1 },
    { id: 'courses-3', icon: '👑', titleKey: 'achCourses3', descKey: 'achCourses3Desc', unlocked: completedCourses >= 3 },
    { id: 'streak-3', icon: '🔥', titleKey: 'achStreak3', descKey: 'achStreak3Desc', unlocked: streak >= 3 },
    { id: 'streak-7', icon: '🌟', titleKey: 'achStreak7', descKey: 'achStreak7Desc', unlocked: streak >= 7 },
  ];
}

/** he.ts greeting key for an Asia/Jerusalem hour. */
export function greetingKeyFor(hour: number): HeKey {
  if (hour >= 5 && hour < 12) return 'greetingMorning';
  if (hour >= 12 && hour < 17) return 'greetingNoon';
  if (hour >= 17 && hour < 22) return 'greetingEvening';
  return 'greetingNight';
}
