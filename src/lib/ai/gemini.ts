import { z } from 'zod';
import { MEDIA_PROMPT_SYSTEM, buildUserTurn, type CourseMediaInputs } from './prompt';

/**
 * Gemini client for AI course-media generation — all three stages are Gemini:
 *   1. text model writes the prompts (writeMediaPrompt),
 *   2. Veo generates the video (generateVeoVideo + pollVeoOperation + downloadFile),
 *   3. Imagen generates the stills (generateImage).
 *
 * Implemented against the Generative Language REST API with plain fetch (no SDK
 * dependency). Model IDs come from env; see .env.example.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function aiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  return {
    enabled: process.env.AI_MEDIA_ENABLED === 'true' && !!apiKey,
    apiKey,
    textModel: process.env.GEMINI_TEXT_MODEL || 'gemini-3.1-pro-preview',
    videoModel: process.env.GEMINI_VIDEO_MODEL || 'veo-3.1-fast-generate-preview',
    imageModel: process.env.GEMINI_IMAGE_MODEL || 'imagen-4.0-generate-001',
  };
}

function requireKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  return key;
}

// ── Media plan (the prompt-writer's output) ──────────────────────────────────

export const stillPlanSchema = z.object({
  role: z.string(),
  prompt: z.string(),
  negativePrompt: z.string(),
  aspectRatio: z.string(),
});

export const mediaPlanSchema = z.object({
  concept: z.string(),
  video: z.object({
    prompt: z.string(),
    negativePrompt: z.string(),
    durationSeconds: z.number(),
    aspectRatio: z.string(),
    cameraMotion: z.string(),
  }),
  stills: z.array(stillPlanSchema).min(1),
  palette: z.array(z.string()),
});

export type MediaPlan = z.infer<typeof mediaPlanSchema>;

/**
 * Gemini structured-output schema (OpenAPI subset). Forcing a responseSchema is
 * mandatory: free-form JSON mode occasionally emits a stray bracket even with
 * responseMimeType=application/json. camelCase keys mirror mediaPlanSchema.
 */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    concept: { type: 'STRING' },
    video: {
      type: 'OBJECT',
      properties: {
        prompt: { type: 'STRING' },
        negativePrompt: { type: 'STRING' },
        durationSeconds: { type: 'INTEGER' },
        aspectRatio: { type: 'STRING' },
        cameraMotion: { type: 'STRING' },
      },
      required: ['prompt', 'negativePrompt', 'durationSeconds', 'aspectRatio', 'cameraMotion'],
      propertyOrdering: ['prompt', 'negativePrompt', 'durationSeconds', 'aspectRatio', 'cameraMotion'],
    },
    stills: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          role: { type: 'STRING' },
          prompt: { type: 'STRING' },
          negativePrompt: { type: 'STRING' },
          aspectRatio: { type: 'STRING' },
        },
        required: ['role', 'prompt', 'negativePrompt', 'aspectRatio'],
        propertyOrdering: ['role', 'prompt', 'negativePrompt', 'aspectRatio'],
      },
    },
    palette: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['concept', 'video', 'stills', 'palette'],
  propertyOrdering: ['concept', 'video', 'stills', 'palette'],
};

/** Stage 1: ask the text model for a full media plan (Veo + Imagen prompts). */
export async function writeMediaPrompt(inputs: CourseMediaInputs): Promise<MediaPlan> {
  const key = requireKey();
  const { textModel } = aiConfig();
  const res = await fetch(`${API_BASE}/models/${textModel}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: MEDIA_PROMPT_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: buildUserTurn(inputs) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.9,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini text ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini text: empty response');
  return mediaPlanSchema.parse(JSON.parse(text));
}

// ── Stage 2: Veo video (long-running operation) ──────────────────────────────

/** Submit a Veo generation; returns the long-running operation name to poll. */
export async function generateVeoVideo(video: MediaPlan['video']): Promise<string> {
  const key = requireKey();
  const { videoModel } = aiConfig();
  const res = await fetch(`${API_BASE}/models/${videoModel}:predictLongRunning?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: video.prompt }],
      parameters: {
        aspectRatio: video.aspectRatio || '16:9',
        negativePrompt: video.negativePrompt,
        personGeneration: 'allow_all',
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Veo submit ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const op = await res.json();
  if (!op?.name) throw new Error('Veo submit: no operation name');
  return op.name as string;
}

export interface VeoResult {
  done: boolean;
  /** Downloadable file URI (append &key=…) when done. */
  fileUri?: string;
  /** Inline base64 video, if the API returned bytes instead of a URI. */
  bytesBase64?: string;
}

/** Poll a Veo operation once. Loop this with a delay until done is true. */
export async function pollVeoOperation(operationName: string): Promise<VeoResult> {
  const key = requireKey();
  const res = await fetch(`${API_BASE}/${operationName}?key=${key}`);
  if (!res.ok) {
    throw new Error(`Veo poll ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const op = await res.json();
  if (!op?.done) return { done: false };
  if (op.error) throw new Error(`Veo failed: ${JSON.stringify(op.error).slice(0, 500)}`);
  // Response shape varies by version; probe the known locations.
  const sample =
    op.response?.generateVideoResponse?.generatedSamples?.[0] ??
    op.response?.generatedSamples?.[0] ??
    op.response?.videos?.[0];
  const fileUri: string | undefined =
    sample?.video?.uri ?? sample?.uri ?? sample?.video?.fileUri;
  const bytesBase64: string | undefined =
    sample?.video?.bytesBase64Encoded ?? sample?.bytesBase64Encoded;
  if (!fileUri && !bytesBase64) {
    throw new Error(`Veo done but no video payload: ${JSON.stringify(op.response ?? {}).slice(0, 500)}`);
  }
  return { done: true, fileUri, bytesBase64 };
}

/** Download a Veo file URI (needs the API key appended) into a Buffer. */
export async function downloadFile(fileUri: string): Promise<Buffer> {
  const key = requireKey();
  const url = fileUri.includes('key=') ? fileUri : `${fileUri}${fileUri.includes('?') ? '&' : '?'}key=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Veo download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Stage 3: Imagen stills ───────────────────────────────────────────────────

export interface GeneratedImage {
  role: string;
  bytesBase64: string;
  mimeType: string;
  aspectRatio: string;
}

/** Generate one still with Imagen. (Imagen 4 folds "avoid" hints into the prompt.) */
export async function generateImage(still: MediaPlan['stills'][number]): Promise<GeneratedImage> {
  const key = requireKey();
  const { imageModel } = aiConfig();
  const prompt = still.negativePrompt
    ? `${still.prompt}\n\nAvoid: ${still.negativePrompt}`
    : still.prompt;
  const res = await fetch(`${API_BASE}/models/${imageModel}:predict?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: still.aspectRatio || '16:9',
        personGeneration: 'allow_all',
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Imagen ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = await res.json();
  const pred = data?.predictions?.[0];
  const bytesBase64: string | undefined = pred?.bytesBase64Encoded ?? pred?.image?.bytesBase64Encoded;
  if (!bytesBase64) throw new Error('Imagen: no image bytes in response');
  return {
    role: still.role,
    bytesBase64,
    mimeType: pred?.mimeType ?? 'image/png',
    aspectRatio: still.aspectRatio || '16:9',
  };
}
