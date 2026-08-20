import { describe, expect, it } from 'vitest';
import { videoAnalysisSchema } from '@/lib/transcription/schemas';
import { formatTimestamp, lessonDeepLink } from '@/lib/video/timestamp';

describe('videoAnalysisSchema', () => {
  const valid = {
    language: 'he',
    transcript: [{ startSeconds: 0, endSeconds: 12, text: 'שלום לכולם' }],
    chapters: [{ title: 'הקדמה', startSeconds: 0, endSeconds: 12, summary: 'תקציר' }],
    summary: 'תקציר השיעור',
    keyConcepts: ['מושג א'],
  };

  it('accepts a well-formed Gemini response', () => {
    const parsed = videoAnalysisSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('defaults chapters/summary/keyConcepts-optional fields', () => {
    const parsed = videoAnalysisSchema.safeParse({
      language: 'he',
      transcript: valid.transcript,
      chapters: [],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.summary).toBe('');
      expect(parsed.data.keyConcepts).toEqual([]);
    }
  });

  it('rejects a response missing required fields', () => {
    expect(videoAnalysisSchema.safeParse({ language: 'he' }).success).toBe(false);
  });

  it('rejects an empty transcript array — never a placeholder segment', () => {
    expect(videoAnalysisSchema.safeParse({ ...valid, transcript: [] }).success).toBe(false);
  });

  it('rejects a segment with no text (never a guessed/invented segment)', () => {
    const bad = { ...valid, transcript: [{ startSeconds: 0, endSeconds: 1, text: '' }] };
    expect(videoAnalysisSchema.safeParse(bad).success).toBe(false);
  });
});

describe('formatTimestamp', () => {
  it('formats seconds under an hour as mm:ss', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(452)).toBe('7:32');
    expect(formatTimestamp(59)).toBe('0:59');
  });

  it('formats an hour or more as h:mm:ss', () => {
    expect(formatTimestamp(3661)).toBe('1:01:01');
  });

  it('clamps negative input to zero', () => {
    expect(formatTimestamp(-5)).toBe('0:00');
  });
});

describe('lessonDeepLink', () => {
  it('builds a plain lesson link with no timestamp', () => {
    expect(lessonDeepLink('acme', 'lesson-1')).toBe('/t/acme/lesson/lesson-1');
  });

  it('appends ?t= for a given timestamp', () => {
    expect(lessonDeepLink('acme', 'lesson-1', 452)).toBe('/t/acme/lesson/lesson-1?t=452');
  });
});
