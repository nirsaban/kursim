import { z } from 'zod';

/**
 * Structured output of the lesson-video analysis call. Mirrors the Gemini
 * responseSchema below field-for-field (same pattern as mediaPlanSchema /
 * RESPONSE_SCHEMA in src/lib/ai/gemini.ts) — the model is forced into this
 * exact shape via responseSchema, then this validates it before anything is
 * persisted. A response that fails this parse is never written to the DB.
 */
export const videoAnalysisSchema = z.object({
  language: z.string().min(1),
  transcript: z
    .array(
      z.object({
        startSeconds: z.number().min(0),
        endSeconds: z.number().min(0),
        text: z.string().min(1),
      }),
    )
    .min(1),
  chapters: z.array(
    z.object({
      title: z.string().min(1),
      startSeconds: z.number().min(0),
      endSeconds: z.number().min(0),
      summary: z.string().default(''),
    }),
  ),
  summary: z.string().default(''),
  keyConcepts: z.array(z.string()).default([]),
});

export type VideoAnalysis = z.infer<typeof videoAnalysisSchema>;

/** Gemini responseSchema (OpenAPI subset) forcing the shape above. */
export const VIDEO_ANALYSIS_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    language: { type: 'STRING' },
    transcript: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          startSeconds: { type: 'NUMBER' },
          endSeconds: { type: 'NUMBER' },
          text: { type: 'STRING' },
        },
        required: ['startSeconds', 'endSeconds', 'text'],
        propertyOrdering: ['startSeconds', 'endSeconds', 'text'],
      },
    },
    chapters: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          startSeconds: { type: 'NUMBER' },
          endSeconds: { type: 'NUMBER' },
          summary: { type: 'STRING' },
        },
        required: ['title', 'startSeconds', 'endSeconds', 'summary'],
        propertyOrdering: ['title', 'startSeconds', 'endSeconds', 'summary'],
      },
    },
    summary: { type: 'STRING' },
    keyConcepts: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['language', 'transcript', 'chapters', 'summary', 'keyConcepts'],
  propertyOrdering: ['language', 'transcript', 'chapters', 'summary', 'keyConcepts'],
} as const;
