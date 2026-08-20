/**
 * Embedding provider for the knowledge pipeline (src/lib/knowledge/). One
 * interface, one concrete Gemini implementation, one place model/dimension
 * config lives — nothing else in the app calls Gemini's embedding endpoint
 * directly. Same plain-fetch convention as gemini.ts / gemini-stt.ts.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Centralized embedding dimension. gemini-embedding-001 defaults to 3072
 * dims but supports truncating via `output_dimensionality` (Matryoshka
 * representation) — requested explicitly below to match the `vector(768)`
 * column. If GEMINI_EMBEDDING_MODEL or this dimension ever changes, this
 * constant — and the column + a new migration — must change together. Never
 * silently mix vectors of different dimensions; that's what
 * KnowledgeChunk.embeddingModel/embeddingDim are for (a model change forces
 * a new KnowledgeVersion, not an in-place reinterpretation).
 *
 * NOTE: text-embedding-004 (the original default here) was fully shut down
 * by Google on 2026-01-14 — every call to it now fails. gemini-embedding-001
 * is its stable replacement.
 */
export const EMBEDDING_DIM = 768;

// Gemini's batchEmbedContents caps at 100 requests per call.
const BATCH_LIMIT = 100;

export function embeddingConfig() {
  return {
    model: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
    apiKey: process.env.GEMINI_API_KEY,
  };
}

function requireKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  return key;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

class GeminiEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const key = requireKey();
    const { model } = embeddingConfig();
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
      const batch = texts.slice(i, i + BATCH_LIMIT);
      const res = await fetch(`${API_BASE}/models/${model}:batchEmbedContents?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
            output_dimensionality: EMBEDDING_DIM,
          })),
        }),
      });
      if (!res.ok) {
        // Gemini error bodies are plain error descriptions, never secrets or
        // signed URLs — safe to log in full for ops visibility (unlike the
        // media-fetch errors elsewhere in the app, which can carry those).
        const body = (await res.text()).slice(0, 500);
        console.error(`[embeddings] Gemini embed ${res.status}: ${body}`);
        throw new Error(`Gemini embed ${res.status}: ${body}`);
      }
      const data = (await res.json()) as { embeddings?: Array<{ values?: number[] }> };
      const embeddings = data.embeddings ?? [];
      if (embeddings.length !== batch.length) {
        throw new Error('Gemini embed: response count mismatch');
      }
      for (const e of embeddings) {
        if (!e.values || e.values.length !== EMBEDDING_DIM) {
          throw new Error(`Gemini embed: unexpected dimension (${e.values?.length ?? 0})`);
        }
        out.push(e.values);
      }
    }
    return out;
  }
}

let provider: EmbeddingProvider | null = null;

/** Single instantiation point — nothing else constructs an EmbeddingProvider. */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (!provider) provider = new GeminiEmbeddingProvider();
  return provider;
}
