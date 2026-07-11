import { describe, it, expect } from 'vitest';
import { homepageSchema, parseHomepage, emptyHomepage } from '@/lib/validation/homepage';

describe('parseHomepage', () => {
  it('falls back to emptyHomepage for null/undefined/garbage', () => {
    expect(parseHomepage(undefined)).toEqual(emptyHomepage);
    expect(parseHomepage(null)).toEqual(emptyHomepage);
    expect(parseHomepage('not an object')).toEqual(emptyHomepage);
    expect(parseHomepage({ announcements: 'nope' })).toEqual(emptyHomepage);
  });

  it('keeps valid content and fills defaults', () => {
    const hp = parseHomepage({ welcomeHeadline: 'ברוכים הבאים', accent: 'copper' });
    expect(hp.welcomeHeadline).toBe('ברוכים הבאים');
    expect(hp.accent).toBe('copper');
    expect(hp.showStats).toBe(true);
    expect(hp.announcements).toEqual([]);
  });
});

describe('homepageSchema', () => {
  it('defaults all section toggles to true', () => {
    const hp = homepageSchema.parse({});
    expect(hp.showStats).toBe(true);
    expect(hp.showAchievements).toBe(true);
    expect(hp.showCatalog).toBe(true);
  });

  it('rejects more than 10 announcements', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ title: `הודעה ${i}` }));
    expect(homepageSchema.safeParse({ announcements: many }).success).toBe(false);
  });

  it('rejects a bad announcement date format', () => {
    const bad = { announcements: [{ title: 'עדכון', date: '11/07/2026' }] };
    expect(homepageSchema.safeParse(bad).success).toBe(false);
    const good = { announcements: [{ title: 'עדכון', date: '2026-07-11' }] };
    expect(homepageSchema.safeParse(good).success).toBe(true);
  });

  it('rejects a non-uuid featuredCourseId but allows empty', () => {
    expect(homepageSchema.safeParse({ featuredCourseId: 'abc' }).success).toBe(false);
    expect(homepageSchema.safeParse({ featuredCourseId: '' }).success).toBe(true);
  });

  it('rejects an unknown accent', () => {
    expect(homepageSchema.safeParse({ accent: 'neon' }).success).toBe(false);
  });
});
