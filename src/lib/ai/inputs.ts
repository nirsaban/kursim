import { LANDING_THEMES } from '@/lib/landing-themes';
import { parseMarketing } from '@/lib/validation/marketing';
import type { CourseMediaInputs } from './prompt';

/** Build the Gemini prompt-writer inputs from a course + its marketing JSON. */
export function courseToMediaInputs(course: {
  title: string;
  description?: string | null;
  marketing: unknown;
}): CourseMediaInputs {
  const m = parseMarketing(course.marketing);
  const theme = LANDING_THEMES[m.accent];
  const outcomes = m.outcomes.length ? m.outcomes : m.benefits.map((b) => b.title);
  return {
    title: course.title,
    topic: m.headline || course.title,
    audience: m.audience.join('; ') || 'לומדים מתעניינים בתחום',
    outcomes: outcomes.slice(0, 6),
    tone: 'חם, מקצועי ומזמין',
    language: 'he',
    region: 'IL',
    accentColorHex: theme.main,
    emoji: m.emoji,
    instructorName: m.instructorName,
    industry: '',
  };
}
