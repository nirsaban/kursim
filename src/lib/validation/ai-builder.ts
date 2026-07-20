import { z } from 'zod';
import { LANDING_ACCENTS, LANDING_LAYOUTS } from './marketing';

/**
 * The AI Builder wizard's questions. Shared by both targets (course landing
 * page and tenant home page) — the copywriter prompt adapts to the target.
 */
export const AI_BUILDER_GOALS = ['sales', 'trust', 'explain', 'recruit'] as const;
export type AiBuilderGoal = (typeof AI_BUILDER_GOALS)[number];

export const AI_BUILDER_TONES = ['warm', 'professional', 'bold', 'minimal'] as const;
export type AiBuilderTone = (typeof AI_BUILDER_TONES)[number];

/** Maps to the Gemini `temperature` param — "how much creative liberty". */
export const AI_BUILDER_CREATIVITY = ['safe', 'balanced', 'bold'] as const;
export type AiBuilderCreativity = (typeof AI_BUILDER_CREATIVITY)[number];

export const aiBuilderAnswersSchema = z.object({
  goal: z.enum(AI_BUILDER_GOALS),
  tone: z.enum(AI_BUILDER_TONES),
  creativity: z.enum(AI_BUILDER_CREATIVITY),
  audienceHint: z.string().max(300).default(''),
  sellingPoints: z.string().max(500).default(''),
});
export type AiBuilderAnswers = z.infer<typeof aiBuilderAnswersSchema>;

/**
 * AI-generated landing-page draft — a CONTENT-ONLY subset of marketingSchema.
 * Deliberately excludes: testimonials/reviews (would be fabricated social
 * proof attributed to fake people — never generate those), gallery/media,
 * pricing/payment/contact fields, and sale details (all operational facts
 * only the owner should set).
 */
export const landingAiDraftSchema = z.object({
  headline: z.string().max(120),
  subheadline: z.string().max(300),
  aboutSchool: z.string().max(1200),
  audience: z.array(z.string().min(1).max(200)).max(6),
  outcomes: z.array(z.string().min(1).max(200)).max(8),
  benefits: z.array(z.object({ title: z.string().min(1).max(100), body: z.string().max(300) })).max(6),
  faq: z.array(z.object({ q: z.string().min(1).max(200), a: z.string().min(1).max(1000) })).max(6),
  ctaText: z.string().max(60),
  emoji: z.string().max(8),
  accent: z.enum(LANDING_ACCENTS),
  layout: z.enum(LANDING_LAYOUTS),
});
export type LandingAiDraft = z.infer<typeof landingAiDraftSchema>;

/**
 * Body for the course-less landing draft endpoint (used during course
 * creation, before the course exists in the DB — the caller supplies the
 * facts directly instead of the server loading them from a courseId).
 */
export const landingDraftRequestSchema = z.object({
  answers: aiBuilderAnswersSchema,
  courseTitle: z.string().min(1).max(200),
  courseDescription: z.string().max(2000).default(''),
  existingHeadline: z.string().max(120).default(''),
  existingSubheadline: z.string().max(300).default(''),
  instructorName: z.string().max(100).default(''),
});
export type LandingDraftRequest = z.infer<typeof landingDraftRequestSchema>;

/**
 * AI-generated home-page draft — content-only subset of homepageSchema.
 * Excludes announcements (time-bound, owner-authored facts, not something
 * an AI should invent) and featuredCourseId/section toggles (operational).
 */
export const homepageAiDraftSchema = z.object({
  welcomeHeadline: z.string().max(120),
  aboutSchool: z.string().max(1200),
  emoji: z.string().max(8),
  accent: z.enum(LANDING_ACCENTS),
});
export type HomepageAiDraft = z.infer<typeof homepageAiDraftSchema>;
