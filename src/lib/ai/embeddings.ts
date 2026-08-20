/**
 * Embedding provider for the knowledge pipeline (src/lib/knowledge/). One
 * interface, one concrete Gemini implementation, one place model/dimension
 * config lives — nothing else in the app calls Gemini's embedding endpoint
 * directly. Same plain-fetch convention as gemini.ts / gemini-stt.ts.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Centralized embedding dimension. text-embedding-004 always returns 768.
 * If GEMINI_EMBEDDING_MODEL ever changes to a model with a different width,
 * this constant — and the `vector(768)` column + a new migration — must
 * change together. Never silently mix vectors of different dimensions;
 * that's what KnowledgeChunk.embeddingModel/embeddingDim are for (a model
 * change forces a new KnowledgeVersion, not an in-place reinterpretation).
 */
export const EMBEDDING_DIM = 768;

// Gemini's batchEmbedContents caps at 100 requests per call.
const BATCH_LIMIT = 100;

export function embeddingConfig() {
  return {
    model: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
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
          })),
        }),
      });
      if (!res.ok) {
        throw new Error(`Gemini embed ${res.status}: ${(await res.text()).slice(0, 300)}`);
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
