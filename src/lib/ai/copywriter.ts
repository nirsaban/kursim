import { aiConfig } from './gemini';
import {
  landingAiDraftSchema,
  homepageAiDraftSchema,
  type LandingAiDraft,
  type HomepageAiDraft,
  type AiBuilderAnswers,
} from '@/lib/validation/ai-builder';
import { LANDING_ACCENTS } from '@/lib/validation/marketing';
import { LANDING_LAYOUTS } from '@/lib/validation/marketing';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** "safe" keeps close to the given facts; "bold" allows more creative phrasing. */
const CREATIVITY_TEMPERATURE: Record<AiBuilderAnswers['creativity'], number> = {
  safe: 0.35,
  balanced: 0.65,
  bold: 0.95,
};

const GOAL_HINT: Record<AiBuilderAnswers['goal'], string> = {
  sales: 'Optimize for conversion — a visitor deciding whether to buy right now.',
  trust: 'Optimize for credibility and trust — a skeptical visitor who needs reassurance.',
  explain: 'Optimize for clarity — a visitor who does not yet understand what this actually is.',
  recruit: 'Optimize for attracting the right kind of student/member, not just any visitor.',
};

const TONE_HINT: Record<AiBuilderAnswers['tone'], string> = {
  warm: 'Warm, friendly, personal — like a trusted teacher talking to one student.',
  professional: 'Professional, authoritative, precise — like an established institution.',
  bold: 'Bold, energetic, direct — short punchy sentences, confident claims.',
  minimal: 'Minimal, calm, understated — let the substance speak, no hype.',
};

/**
 * Shared anti-fabrication guardrails for every AI Builder prompt. This content
 * goes on a real, public commercial page — the model must never invent facts
 * that read as real evidence (specific numbers, names, dates, credentials).
 */
const GUARDRAILS = `HARD RULES — this copy will be published on a real commercial page, reviewed but not necessarily fact-checked word-by-word by the owner before publishing:
- NEVER invent specific numbers, statistics, dates, credentials, awards, or claims of authority ("12 years experience", "#1 in Israel", "500 graduates") unless that exact fact was given to you in the input. Prefer general, honest, aspirational language over fabricated specifics.
- NEVER write anything that reads as a customer testimonial, review, or quote attributed to a named person — that is fabricated social proof and must not be produced, even as a placeholder or example.
- NEVER invent named people, dates, or events that could be mistaken for real facts about this school/course.
- Base every claim only on the facts provided in the input. If the input is sparse, write general, benefit-oriented copy rather than inventing specifics to fill the gap.
- Write in the requested language. Keep sentences natural for that language, not a literal translation of English marketing tropes.`;

const RESPONSE_SCHEMA_TYPES = {
  STRING: { type: 'STRING' },
} as const;

function textField(maxLenHint: string) {
  return { type: 'STRING', description: maxLenHint };
}

const LANDING_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: textField('Big hero headline, punchy, under ~12 words'),
    subheadline: textField('One supporting sentence under the headline'),
    aboutSchool: textField('2-4 sentence paragraph about the instructor/school'),
    audience: { type: 'ARRAY', items: RESPONSE_SCHEMA_TYPES.STRING, description: 'Up to 6 short "who this is for" bullets' },
    outcomes: { type: 'ARRAY', items: RESPONSE_SCHEMA_TYPES.STRING, description: 'Up to 8 short "what you will know" bullets' },
    benefits: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { title: RESPONSE_SCHEMA_TYPES.STRING, body: RESPONSE_SCHEMA_TYPES.STRING },
        required: ['title', 'body'],
        propertyOrdering: ['title', 'body'],
      },
      description: 'Up to 6 "why us" cards',
    },
    faq: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { q: RESPONSE_SCHEMA_TYPES.STRING, a: RESPONSE_SCHEMA_TYPES.STRING },
        required: ['q', 'a'],
        propertyOrdering: ['q', 'a'],
      },
      description: 'Up to 6 realistic frequently-asked questions with honest answers',
    },
    ctaText: textField('Short button label, 2-5 words'),
    emoji: textField('One emoji that fits the topic'),
    accent: { type: 'STRING', enum: [...LANDING_ACCENTS] },
    layout: { type: 'STRING', enum: [...LANDING_LAYOUTS] },
  },
  required: ['headline', 'subheadline', 'aboutSchool', 'audience', 'outcomes', 'benefits', 'faq', 'ctaText', 'emoji', 'accent', 'layout'],
  propertyOrdering: ['headline', 'subheadline', 'aboutSchool', 'audience', 'outcomes', 'benefits', 'faq', 'ctaText', 'emoji', 'accent', 'layout'],
};

const HOMEPAGE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    welcomeHeadline: textField('Short warm welcome headline for a logged-in student home page'),
    aboutSchool: textField('2-4 sentence paragraph about the school'),
    emoji: textField('One emoji that fits the school'),
    accent: { type: 'STRING', enum: [...LANDING_ACCENTS] },
  },
  required: ['welcomeHeadline', 'aboutSchool', 'emoji', 'accent'],
  propertyOrdering: ['welcomeHeadline', 'aboutSchool', 'emoji', 'accent'],
};

async function generateContent(systemInstruction: string, userTurn: string, responseSchema: object, temperature: number) {
  const { apiKey, textModel } = aiConfig();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const res = await fetch(`${API_BASE}/models/${textModel}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userTurn }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema, temperature },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini text ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini text: empty response');
  return JSON.parse(text);
}

export interface LandingDraftInputs {
  answers: AiBuilderAnswers;
  language: string;
  courseTitle: string;
  courseDescription: string;
  existingHeadline: string;
  existingSubheadline: string;
  instructorName: string;
}

export async function generateLandingDraft(inputs: LandingDraftInputs): Promise<LandingAiDraft> {
  const { answers } = inputs;
  const system = `You are a senior conversion copywriter writing content for a course-landing-page builder (Kursim). ${GOAL_HINT[answers.goal]} ${TONE_HINT[answers.tone]}

${GUARDRAILS}

Return your answer strictly matching the provided JSON schema. Write in ${inputs.language}.`;
  const userTurn = JSON.stringify({
    courseTitle: inputs.courseTitle,
    courseDescription: inputs.courseDescription || null,
    existingHeadline: inputs.existingHeadline || null,
    existingSubheadline: inputs.existingSubheadline || null,
    instructorName: inputs.instructorName || null,
    audienceHint: answers.audienceHint || null,
    sellingPoints: answers.sellingPoints || null,
  });
  const raw = await generateContent(system, userTurn, LANDING_RESPONSE_SCHEMA, CREATIVITY_TEMPERATURE[answers.creativity]);
  return landingAiDraftSchema.parse(raw);
}

export interface HomepageDraftInputs {
  answers: AiBuilderAnswers;
  language: string;
  tenantName: string;
  existingAboutSchool: string;
  courseTitles: string[];
}

export async function generateHomepageDraft(inputs: HomepageDraftInputs): Promise<HomepageAiDraft> {
  const { answers } = inputs;
  const system = `You are a senior copywriter writing the welcome content for a logged-in-student home page on a course platform (Kursim). This is NOT a sales page — the student already enrolled. ${TONE_HINT[answers.tone]}

${GUARDRAILS}

Return your answer strictly matching the provided JSON schema. Write in ${inputs.language}.`;
  const userTurn = JSON.stringify({
    schoolName: inputs.tenantName,
    existingAboutSchool: inputs.existingAboutSchool || null,
    courseTitles: inputs.courseTitles.slice(0, 10),
    audienceHint: answers.audienceHint || null,
    sellingPoints: answers.sellingPoints || null,
  });
  const raw = await generateContent(system, userTurn, HOMEPAGE_RESPONSE_SCHEMA, CREATIVITY_TEMPERATURE[answers.creativity]);
  return homepageAiDraftSchema.parse(raw);
}
