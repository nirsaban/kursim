import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnrecoverableError } from 'bullmq';

const db = {
  lesson: { findFirst: vi.fn() },
  knowledgeVersion: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
};
vi.mock('@/lib/tenant/scoped-prisma', () => ({ forTenant: () => db }));

const { embedBatch, persistChunksAndActivate, deleteChunksForVersion } = vi.hoisted(() => ({
  embedBatch: vi.fn(),
  persistChunksAndActivate: vi.fn().mockResolvedValue(undefined),
  deleteChunksForVersion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ai/embeddings', () => ({
  getEmbeddingProvider: () => ({ embedBatch, embed: vi.fn() }),
  embeddingConfig: () => ({ model: 'gemini-embedding-001' }),
  EMBEDDING_DIM: 768,
}));

vi.mock('@/lib/knowledge/chunk-repository', () => ({
  persistChunksAndActivate: (...args: unknown[]) => persistChunksAndActivate(...args),
  deleteChunksForVersion: (...args: unknown[]) => deleteChunksForVersion(...args),
}));

import { runIndexJob } from '@/lib/knowledge/indexing';

const TENANT = 'tenant-a';
const LESSON_WITH_TRANSCRIPT = {
  id: 'lesson-1',
  module: { courseId: 'course-1' },
  structuredTranscript: {
    segments: [{ startSeconds: 0, endSeconds: 5, text: 'תוכן השיעור' }],
    chapters: [],
  },
  attachments: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.knowledgeVersion.findFirst.mockResolvedValue(null);
  db.knowledgeVersion.create.mockResolvedValue({ id: 'kv-1' });
  db.knowledgeVersion.update.mockResolvedValue({});
  embedBatch.mockResolvedValue([[0.1, 0.2]]);
});

describe('runIndexJob', () => {
  it('does nothing when the lesson has no transcript and no attachment text', async () => {
    db.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      module: { courseId: 'course-1' },
      structuredTranscript: null,
      attachments: [],
    });
    await runIndexJob(TENANT, 'lesson-1');
    expect(db.knowledgeVersion.create).not.toHaveBeenCalled();
  });

  it('creates a version, chunks, embeds, and atomically activates it', async () => {
    db.lesson.findFirst.mockResolvedValue(LESSON_WITH_TRANSCRIPT);
    await runIndexJob(TENANT, 'lesson-1');

    expect(db.knowledgeVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tenantId: TENANT, courseId: 'course-1', lessonId: 'lesson-1', status: 'PENDING' } }),
    );
    const statuses = db.knowledgeVersion.update.mock.calls.map((c) => c[0].data.status);
    expect(statuses).toEqual(['CHUNKING', 'EMBEDDING', 'ACTIVATING']);
    expect(embedBatch).toHaveBeenCalledWith(['תוכן השיעור']);
    expect(persistChunksAndActivate).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, courseId: 'course-1', lessonId: 'lesson-1', knowledgeVersionId: 'kv-1' }),
    );
  });

  it('resumes an existing non-terminal version instead of creating a second one (idempotent retry)', async () => {
    db.lesson.findFirst.mockResolvedValue(LESSON_WITH_TRANSCRIPT);
    db.knowledgeVersion.findFirst.mockResolvedValue({ id: 'kv-existing', status: 'EMBEDDING' });
    await runIndexJob(TENANT, 'lesson-1');

    expect(db.knowledgeVersion.create).not.toHaveBeenCalled();
    expect(deleteChunksForVersion).toHaveBeenCalledWith(TENANT, 'kv-existing');
    expect(persistChunksAndActivate).toHaveBeenCalledWith(
      expect.objectContaining({ knowledgeVersionId: 'kv-existing' }),
    );
  });

  it('marks the version FAILED and never activates when embedding fails — prior ACTIVE version stays untouched', async () => {
    db.lesson.findFirst.mockResolvedValue(LESSON_WITH_TRANSCRIPT);
    embedBatch.mockRejectedValue(new Error('Gemini embed 500'));

    await expect(runIndexJob(TENANT, 'lesson-1')).rejects.toThrow();

    expect(persistChunksAndActivate).not.toHaveBeenCalled();
    const failedCall = db.knowledgeVersion.update.mock.calls.find((c) => c[0].data.status === 'FAILED');
    expect(failedCall![0].data.error).toBe('KNOWLEDGE_INDEXING_ERROR');
  });

  it('fails permanently when the lesson is gone', async () => {
    db.lesson.findFirst.mockResolvedValue(null);
    await expect(runIndexJob(TENANT, 'lesson-1')).rejects.toThrow(UnrecoverableError);
  });
});
