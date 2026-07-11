import { describe, it, expect } from 'vitest';
import {
  dayKey,
  prevDayKey,
  computeStreak,
  computeAchievements,
  greetingKeyFor,
} from '@/lib/achievements';

describe('dayKey', () => {
  it('formats a date as yyyy-mm-dd in Asia/Jerusalem', () => {
    expect(dayKey(new Date('2026-07-10T12:00:00Z'))).toBe('2026-07-10');
  });

  it('rolls to the next day after UTC 21:00/22:00 (Jerusalem midnight)', () => {
    // 22:30 UTC = 01:30 IDT the next day
    expect(dayKey(new Date('2026-07-10T22:30:00Z'))).toBe('2026-07-11');
  });

  it('stays on the same day just before Jerusalem midnight', () => {
    // 20:30 UTC = 23:30 IDT same day
    expect(dayKey(new Date('2026-07-10T20:30:00Z'))).toBe('2026-07-10');
  });
});

describe('prevDayKey', () => {
  it('steps back one calendar day', () => {
    expect(prevDayKey('2026-07-11')).toBe('2026-07-10');
  });

  it('crosses month and year boundaries', () => {
    expect(prevDayKey('2026-03-01')).toBe('2026-02-28');
    expect(prevDayKey('2026-01-01')).toBe('2025-12-31');
  });
});

describe('computeStreak', () => {
  const today = new Date('2026-07-10T12:00:00Z'); // 2026-07-10 in Jerusalem

  it('returns 0 with no activity', () => {
    expect(computeStreak([], today)).toBe(0);
  });

  it('counts today alone as 1', () => {
    expect(computeStreak(['2026-07-10'], today)).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-07-08', '2026-07-09', '2026-07-10'], today)).toBe(3);
  });

  it('still counts a streak ending yesterday (not yet broken)', () => {
    expect(computeStreak(['2026-07-08', '2026-07-09'], today)).toBe(2);
  });

  it('breaks on a gap', () => {
    expect(computeStreak(['2026-07-06', '2026-07-07', '2026-07-10'], today)).toBe(1);
    expect(computeStreak(['2026-07-06', '2026-07-07'], today)).toBe(0);
  });
});

describe('computeAchievements', () => {
  it('unlocks nothing for a fresh student', () => {
    const all = computeAchievements({ completedLessons: 0, completedCourses: 0, streak: 0 });
    expect(all).toHaveLength(8);
    expect(all.every((a) => !a.unlocked)).toBe(true);
  });

  it('unlocks lesson milestones at 1/5/10/25', () => {
    const at5 = computeAchievements({ completedLessons: 5, completedCourses: 0, streak: 0 });
    const unlocked = at5.filter((a) => a.unlocked).map((a) => a.id);
    expect(unlocked).toEqual(['first-lesson', 'lessons-5']);
  });

  it('unlocks course and streak badges at their thresholds', () => {
    const all = computeAchievements({ completedLessons: 30, completedCourses: 3, streak: 7 });
    expect(all.every((a) => a.unlocked)).toBe(true);
  });
});

describe('greetingKeyFor', () => {
  it('maps hours to the right greeting', () => {
    expect(greetingKeyFor(6)).toBe('greetingMorning');
    expect(greetingKeyFor(13)).toBe('greetingNoon');
    expect(greetingKeyFor(19)).toBe('greetingEvening');
    expect(greetingKeyFor(23)).toBe('greetingNight');
    expect(greetingKeyFor(2)).toBe('greetingNight');
  });
});
