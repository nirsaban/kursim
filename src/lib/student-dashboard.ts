import type { TenantClient } from '@/lib/tenant/scoped-prisma';
import { parseMarketing, type LandingAccent } from '@/lib/validation/marketing';

/**
 * Shared aggregation for the student home dashboard and the journey page:
 * per-course journey state, cross-course totals, and the single best
 * "continue learning" target.
 */

export type ModuleMilestone = {
  title: string;
  done: boolean;
  totalLessons: number;
  completedLessons: number;
};

export type CourseJourney = {
  id: string;
  title: string;
  description: string | null;
  accent: LandingAccent;
  emoji: string;
  totalLessons: number;
  completedLessons: number;
  pct: number;
  milestones: ModuleMilestone[];
  nextLesson: { id: string; title: string } | null;
};

export type ContinueTarget = {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  accent: LandingAccent;
  emoji: string;
  pct: number;
};

export type StudentDashboard = {
  courses: CourseJourney[];
  totals: { lessonsDone: number; coursesDone: number; minutes: number };
  continueTarget: ContinueTarget | null;
};

export async function getStudentDashboard(
  db: TenantClient,
  studentId: string,
): Promise<StudentDashboard> {
  const [enrollments, progress] = await Promise.all([
    db.enrollment.findMany({
      where: { studentId },
      include: {
        course: {
          include: {
            modules: {
              orderBy: { sortOrder: 'asc' },
              include: {
                lessons: {
                  orderBy: { sortOrder: 'asc' },
                  select: { id: true, title: true, durationSec: true },
                },
              },
            },
          },
        },
      },
    }),
    db.progress.findMany({
      where: { studentId },
      select: { lessonId: true, completedAt: true, lastPositionSec: true, updatedAt: true },
    }),
  ]);

  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));
  const isCompleted = (lessonId: string) => Boolean(byLesson.get(lessonId)?.completedAt);
  const isStarted = (lessonId: string) => {
    const p = byLesson.get(lessonId);
    return Boolean(p && !p.completedAt && p.lastPositionSec > 0);
  };

  const publishedCourses = enrollments
    .map((e) => e.course)
    .filter((c) => c.status === 'PUBLISHED');

  let lessonsDone = 0;
  let coursesDone = 0;
  let seconds = 0;

  const courses: CourseJourney[] = publishedCourses.map((course) => {
    const m = parseMarketing(course.marketing);
    const allLessons = course.modules.flatMap((mod) => mod.lessons);
    const done = allLessons.filter((l) => isCompleted(l.id));
    const pct = allLessons.length ? Math.round((done.length / allLessons.length) * 100) : 0;

    lessonsDone += done.length;
    if (allLessons.length > 0 && pct === 100) coursesDone += 1;
    for (const l of allLessons) {
      const p = byLesson.get(l.id);
      if (!p) continue;
      seconds += p.completedAt ? (l.durationSec ?? p.lastPositionSec) : p.lastPositionSec;
    }

    // Same continue logic as the course page: first started, else first not completed.
    const next =
      allLessons.find((l) => isStarted(l.id)) ?? allLessons.find((l) => !isCompleted(l.id));

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      accent: m.accent,
      emoji: m.emoji,
      totalLessons: allLessons.length,
      completedLessons: done.length,
      pct,
      milestones: course.modules.map((mod) => {
        const completedInModule = mod.lessons.filter((l) => isCompleted(l.id)).length;
        return {
          title: mod.title,
          done: mod.lessons.length > 0 && completedInModule === mod.lessons.length,
          totalLessons: mod.lessons.length,
          completedLessons: completedInModule,
        };
      }),
      nextLesson: next ? { id: next.id, title: next.title } : null,
    };
  });

  // Continue target = the course the student touched most recently that still
  // has a next lesson; falls back to the first course with anything left.
  let continueTarget: ContinueTarget | null = null;
  let bestTouch = -1;
  for (const course of publishedCourses) {
    const journey = courses.find((c) => c.id === course.id)!;
    if (!journey.nextLesson) continue;
    const touched = Math.max(
      0,
      ...course.modules.flatMap((mod) =>
        mod.lessons.map((l) => byLesson.get(l.id)?.updatedAt.getTime() ?? 0),
      ),
    );
    if (touched > bestTouch) {
      bestTouch = touched;
      continueTarget = {
        courseId: journey.id,
        courseTitle: journey.title,
        lessonId: journey.nextLesson.id,
        lessonTitle: journey.nextLesson.title,
        accent: journey.accent,
        emoji: journey.emoji,
        pct: journey.pct,
      };
    }
  }

  return {
    courses,
    totals: { lessonsDone, coursesDone, minutes: Math.round(seconds / 60) },
    continueTarget,
  };
}
