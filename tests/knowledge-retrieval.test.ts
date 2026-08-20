import { beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny in-memory "database" of chunks per (tenantId, courseId), so the test
// can prove the retrieval layer never crosses those boundaries — the same
// shape of guarantee RLS + the WHERE clause give in chunk-repository.ts.
const FAKE_CHUNKS: Record<string, Array<{ content: string; lessonId: string; lessonTitle: string }>> = {
  'tenant-a:course-a': [{ content: 'tenant A course A content', lessonId: 'l1', lessonTitle: 'שיעור 1' }],
  'tenant-a:course-b': [{ content: 'tenant A course B content', lessonId: 'l2', lessonTitle: 'שיעור 2' }],
  'tenant-b:course-a': [{ content: 'tenant B course A content', lessonId: 'l3', lessonTitle: 'שיעור 3' }],
};

const { embed, search } = vi.hoisted(() => ({
  embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  search: vi.fn(),
}));

vi.mock('@/lib/ai/embeddings', () => ({
  getEmbeddingProvider: () => ({ embed, embedBatch: vi.fn() }),
}));

vi.mock('@/lib/knowledge/chunk-repository', () => ({
  searchActiveChunks: (tenantId: string, courseId: string, _vec: number[], limit: number) =>
    search(tenantId, courseId, _vec, limit),
}));

import { pgvectorRetriever } from '@/lib/knowledge/retrieval';

beforeEach(() => {
  vi.clearAllMocks();
  embed.mockResolvedValue([0.1, 0.2, 0.3]);
  search.mockImplementation((tenantId: string, courseId: string) =>
    Promise.resolve(
      (FAKE_CHUNKS[`${tenantId}:${courseId}`] ?? []).map((c) => ({
        ...c,
        startSeconds: 0,
        endSeconds: 10,
        metadata: null,
        score: 0.9,
      })),
    ),
  );
});

describe('pgvectorRetriever.search — tenant/course isolation', () => {
  it('only ever passes through the exact tenantId/courseId given — never derived, never defaulted', async () => {
    await pgvectorRetriever.search({ tenantId: 'tenant-a', courseId: 'course-a', query: 'שאלה' });
    expect(search).toHaveBeenCalledWith('tenant-a', 'course-a', expect.any(Array), expect.any(Number));
  });

  it('tenant A never sees tenant B chunks for the "same" courseId string', async () => {
    const a = await pgvectorRetriever.search({ tenantId: 'tenant-a', courseId: 'course-a', query: 'q' });
    const b = await pgvectorRetriever.search({ tenantId: 'tenant-b', courseId: 'course-a', query: 'q' });
    expect(a.map((r) => r.content)).toEqual(['tenant A course A content']);
    expect(b.map((r) => r.content)).toEqual(['tenant B course A content']);
    expect(a).not.toEqual(b);
  });

  it('course A never leaks course B chunks within the same tenant', async () => {
    const a = await pgvectorRetriever.search({ tenantId: 'tenant-a', courseId: 'course-a', query: 'q' });
    const b = await pgvectorRetriever.search({ tenantId: 'tenant-a', courseId: 'course-b', query: 'q' });
    expect(a.map((r) => r.content)).toEqual(['tenant A course A content']);
    expect(b.map((r) => r.content)).toEqual(['tenant A course B content']);
  });

  it('returns no results (not an error) and does not embed for a blank query', async () => {
    const results = await pgvectorRetriever.search({ tenantId: 'tenant-a', courseId: 'course-a', query: '   ' });
    expect(results).toEqual([]);
    expect(embed).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it('respects a custom limit, defaulting otherwise', async () => {
    await pgvectorRetriever.search({ tenantId: 'tenant-a', courseId: 'course-a', query: 'q', limit: 3 });
    expect(search).toHaveBeenCalledWith('tenant-a', 'course-a', expect.any(Array), 3);
  });
});
