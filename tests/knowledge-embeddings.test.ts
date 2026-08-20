import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function mockFetchOnce(embeddings: Array<{ values?: number[] } | undefined>) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ embeddings }),
    text: async () => '',
  });
}

const okVector = () => Array.from({ length: 768 }, () => 0.1);

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe('GeminiEmbeddingProvider', () => {
  it('embeds a single text via one batchEmbedContents call', async () => {
    const fetchMock = mockFetchOnce([{ values: okVector() }]);
    vi.stubGlobal('fetch', fetchMock);
    const { getEmbeddingProvider, EMBEDDING_DIM } = await import('@/lib/ai/embeddings');

    const vector = await getEmbeddingProvider().embed('hello');
    expect(vector).toHaveLength(EMBEDDING_DIM);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('batchEmbedContents');
  });

  it('embeds a batch in one call when under the 100-request limit', async () => {
    const texts = Array.from({ length: 5 }, (_, i) => `chunk ${i}`);
    const fetchMock = mockFetchOnce(texts.map(() => ({ values: okVector() })));
    vi.stubGlobal('fetch', fetchMock);
    const { getEmbeddingProvider } = await import('@/lib/ai/embeddings');

    const vectors = await getEmbeddingProvider().embedBatch(texts);
    expect(vectors).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.requests).toHaveLength(5);
  });

  it('splits more than 100 texts into multiple batch calls', async () => {
    const texts = Array.from({ length: 150 }, (_, i) => `chunk ${i}`);
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      return {
        ok: true,
        json: async () => ({ embeddings: body.requests.map(() => ({ values: okVector() })) }),
        text: async () => '',
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const { getEmbeddingProvider } = await import('@/lib/ai/embeddings');

    const vectors = await getEmbeddingProvider().embedBatch(texts);
    expect(vectors).toHaveLength(150);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 100 + 50
  });

  it('rejects a response with the wrong embedding count', async () => {
    const fetchMock = mockFetchOnce([{ values: okVector() }]); // only 1, asked for 2
    vi.stubGlobal('fetch', fetchMock);
    const { getEmbeddingProvider } = await import('@/lib/ai/embeddings');
    await expect(getEmbeddingProvider().embedBatch(['a', 'b'])).rejects.toThrow(/count mismatch/);
  });

  it('rejects a vector with the wrong dimension rather than silently persisting it', async () => {
    const fetchMock = mockFetchOnce([{ values: [0.1, 0.2] }]);
    vi.stubGlobal('fetch', fetchMock);
    const { getEmbeddingProvider } = await import('@/lib/ai/embeddings');
    await expect(getEmbeddingProvider().embed('short')).rejects.toThrow(/dimension/);
  });
});
