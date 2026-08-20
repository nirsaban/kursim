import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks: no real DB, Redis, Gemini or Cloudinary in tests ─────────────────

vi.mock('@/lib/redis', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const client = new RedisMock();
  return { getRedis: () => client, createSubscriber: () => client.duplicate() };
});

const db = {
  lesson: {
    findFirst: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  attachment: {
    findFirst: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  module: { findMany: vi.fn().mockResolvedValue([]) },
  transcript: { upsert: vi.fn().mockResolvedValue({ id: 'transcript-1' }) },
  transcriptSegment: {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  chapter: {
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
};
vi.mock('@/lib/tenant/scoped-prisma', () => ({ forTenant: () => db }));

const { enqueue, enqueueIndex, transcribe, analyze, audioCleanup, invalidate } = vi.hoisted(() => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
  enqueueIndex: vi.fn().mockResolvedValue(undefined),
  transcribe: vi.fn(),
  analyze: vi.fn(),
  audioCleanup: vi.fn().mockResolvedValue(undefined),
  invalidate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/transcription/queue', () => ({
  enqueueTranscription: (job: unknown) => enqueue(job),
  enqueueKnowledgeIndexing: (tenantId: string, lessonId: string) => enqueueIndex(tenantId, lessonId),
  TRANSCRIPTION_QUEUE: 'transcription',
}));

vi.mock('@/lib/transcription/gemini-stt', () => ({
  transcriptionConfig: () => ({ enabled: true, apiKey: 'test', model: 'test-model' }),
  transcribeMedia: (...args: unknown[]) => transcribe(...args),
  analyzeStructuredMedia: (...args: unknown[]) => analyze(...args),
  TRANSCRIBE_PROMPT: 'transcribe',
  EXTRACT_PROMPT: 'extract',
}));

vi.mock('@/lib/transcription/media', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/transcription/media')>();
  return {
    ...real,
    extractLessonAudio: vi.fn().mockResolvedValue({
      audio: Buffer.from('fake-audio'),
      cleanup: audioCleanup,
    }),
    fetchAttachmentBytes: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
  };
});

vi.mock('@/lib/mentor', () => ({ invalidateCourseBrain: (id: string) => invalidate(id) }));

import { UnrecoverableError } from 'bullmq';
import {
  requestLessonTranscription,
  requestAttachmentExtraction,
  runTranscriptionJob,
} from '@/lib/transcription/service';
import { attachmentReadable, attachmentMime } from '@/lib/transcription/media';

const TENANT = 'tenant-a';
const LESSON = {
  id: 'lesson-1',
  title: 'שיעור',
  videoPublicId: 'tenants/tenant-a/courses/c1/vid',
  videoProvider: 'CLOUDINARY' as const,
  durationSec: 300,
  transcriptStatus: 'PENDING',
  module: { courseId: 'course-1' },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.lesson.updateMany.mockResolvedValue({ count: 1 });
  db.attachment.updateMany.mockResolvedValue({ count: 1 });
});

// ── Requests ────────────────────────────────────────────────────────────────

describe('requestLessonTranscription', () => {
  it('queues a lesson with a video and marks it PENDING', async () => {
    db.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      videoPublicId: 'v',
      transcriptStatus: 'NONE',
    });
    expect(await requestLessonTranscription(TENANT, 'lesson-1')).toBe('queued');
    expect(db.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { transcriptStatus: 'PENDING', transcriptError: null },
      }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'lesson', id: 'lesson-1' }),
    );
  });

  it('skips an already-completed lesson unless forced', async () => {
    db.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      videoPublicId: 'v',
      transcriptStatus: 'COMPLETED',
    });
    expect(await requestLessonTranscription(TENANT, 'lesson-1')).toBe('skipped');
    expect(enqueue).not.toHaveBeenCalled();

    expect(await requestLessonTranscription(TENANT, 'lesson-1', { force: true })).toBe('queued');
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ force: true }));
  });

  it('re-queues a FAILED lesson without force', async () => {
    db.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      videoPublicId: 'v',
      transcriptStatus: 'FAILED',
    });
    expect(await requestLessonTranscription(TENANT, 'lesson-1')).toBe('queued');
  });

  it('reports no_media when the lesson has no video', async () => {
    db.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      videoPublicId: null,
      transcriptStatus: 'NONE',
    });
    expect(await requestLessonTranscription(TENANT, 'lesson-1')).toBe('no_media');
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('requestAttachmentExtraction', () => {
  it('queues a readable attachment', async () => {
    db.attachment.findFirst.mockResolvedValue({
      id: 'att-1',
      filename: 'סיכום.pdf',
      kind: 'DOC',
      textStatus: 'NONE',
    });
    expect(await requestAttachmentExtraction(TENANT, 'att-1')).toBe('queued');
  });

  it('refuses an unreadable attachment kind', async () => {
    db.attachment.findFirst.mockResolvedValue({
      id: 'att-1',
      filename: 'archive.zip',
      kind: 'OTHER',
      textStatus: 'NONE',
    });
    expect(await requestAttachmentExtraction(TENANT, 'att-1')).toBe('no_media');
  });
});

// ── Job execution ───────────────────────────────────────────────────────────

/** A minimal valid videoAnalysisSchema payload, one segment holding `text`. */
function analysisPayload(text: string, extra: Record<string, unknown> = {}) {
  return {
    language: 'he',
    transcript: [{ startSeconds: 0, endSeconds: 10, text }],
    chapters: [],
    summary: '',
    keyConcepts: [],
    ...extra,
  };
}

describe('runTranscriptionJob (lesson)', () => {
  const job = { tenantId: TENANT, kind: 'lesson' as const, id: 'lesson-1' };

  it('saves a structured transcript, marks COMPLETED and invalidates the brain', async () => {
    db.lesson.findFirst.mockResolvedValue(LESSON);
    analyze.mockResolvedValue({
      data: analysisPayload('תמליל השיעור המלא כאן'),
      inputTokens: 10,
      outputTokens: 5,
    });

    await runTranscriptionJob(job);

    expect(db.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transcript: 'תמליל השיעור המלא כאן',
          transcriptStatus: 'COMPLETED',
          transcriptLang: 'he',
          transcriptError: null,
        }),
      }),
    );
    expect(db.transcript.upsert).toHaveBeenCalled();
    expect(db.transcriptSegment.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ text: 'תמליל השיעור המלא כאן', sequence: 0 })],
      }),
    );
    expect(invalidate).toHaveBeenCalledWith('course-1');
    expect(audioCleanup).toHaveBeenCalled();
    // Chunking/embedding/activation is a separate job, not inlined here.
    expect(enqueueIndex).toHaveBeenCalledWith(TENANT, 'lesson-1');
  });

  it('claims PROCESSING before transcribing (idempotency lock)', async () => {
    db.lesson.findFirst.mockResolvedValue(LESSON);
    analyze.mockResolvedValue({ data: analysisPayload('תמליל ארוך מספיק'), inputTokens: 1, outputTokens: 1 });
    await runTranscriptionJob(job);
    expect(db.lesson.updateMany).toHaveBeenCalledWith({
      where: { id: 'lesson-1', transcriptStatus: { not: 'PROCESSING' } },
      data: { transcriptStatus: 'PROCESSING', transcriptError: null },
    });
  });

  it('exits without calling Gemini when another job holds PROCESSING', async () => {
    db.lesson.findFirst.mockResolvedValue(LESSON);
    db.lesson.updateMany.mockResolvedValue({ count: 0 });
    await runTranscriptionJob(job);
    expect(analyze).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('returns early on COMPLETED without force — no double spend', async () => {
    db.lesson.findFirst.mockResolvedValue({ ...LESSON, transcriptStatus: 'COMPLETED' });
    await runTranscriptionJob(job);
    expect(analyze).not.toHaveBeenCalled();
    expect(db.lesson.update).not.toHaveBeenCalled(); // transcript untouched
  });

  it('re-transcribes a COMPLETED lesson when forced', async () => {
    db.lesson.findFirst.mockResolvedValue({ ...LESSON, transcriptStatus: 'COMPLETED' });
    analyze.mockResolvedValue({ data: analysisPayload('תמליל חדש ומעודכן'), inputTokens: 1, outputTokens: 1 });
    await runTranscriptionJob({ ...job, force: true });
    expect(db.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ transcript: 'תמליל חדש ומעודכן' }),
      }),
    );
  });

  it('rejects a too-short transcript as a permanent failure', async () => {
    db.lesson.findFirst.mockResolvedValue(LESSON);
    analyze.mockResolvedValue({ data: analysisPayload('הי'), inputTokens: 1, outputTokens: 0 });
    await expect(runTranscriptionJob(job)).rejects.toThrow(UnrecoverableError);
    expect(db.lesson.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { transcriptStatus: 'FAILED', transcriptError: 'EMPTY_TRANSCRIPT' },
      }),
    );
  });

  it('rejects a Gemini response that fails schema validation, retryable', async () => {
    db.lesson.findFirst.mockResolvedValue(LESSON);
    analyze.mockResolvedValue({ data: { not: 'the expected shape' }, inputTokens: 1, outputTokens: 0 });
    await expect(runTranscriptionJob(job)).rejects.toThrow('TRANSCRIPT_SCHEMA_INVALID');
    // Not an UnrecoverableError → BullMQ retries it.
    await expect(runTranscriptionJob(job)).rejects.not.toBeInstanceOf(UnrecoverableError);
  });

  it('marks FAILED with a safe code on provider error, and rethrows for retry', async () => {
    db.lesson.findFirst.mockResolvedValue(LESSON);
    analyze.mockRejectedValue(new Error('Gemini structured 429: https://signed-url-secret'));
    await expect(runTranscriptionJob(job)).rejects.toThrow(/429/);
    // Not an UnrecoverableError → BullMQ retries it.
    await expect(runTranscriptionJob(job)).rejects.not.toBeInstanceOf(UnrecoverableError);
    const failedCall = db.lesson.update.mock.calls.find(
      (c) => c[0].data.transcriptStatus === 'FAILED',
    );
    // The stored error is a stable code — never the raw message with URLs.
    expect(failedCall![0].data.transcriptError).toBe('TRANSCRIPTION_PROVIDER_ERROR');
  });

  it('fails permanently when the lesson is gone', async () => {
    db.lesson.findFirst.mockResolvedValue(null);
    await expect(runTranscriptionJob(job)).rejects.toThrow('LESSON_NOT_FOUND');
  });

  it('fails permanently when the video is gone', async () => {
    db.lesson.findFirst.mockResolvedValue({ ...LESSON, videoPublicId: null });
    await expect(runTranscriptionJob(job)).rejects.toThrow('LESSON_VIDEO_NOT_FOUND');
  });
});

describe('runTranscriptionJob (attachment)', () => {
  const job = { tenantId: TENANT, kind: 'attachment' as const, id: 'att-1' };
  const ATT = {
    id: 'att-1',
    lessonId: 'lesson-1',
    publicId: 'tenants/tenant-a/courses/c1/doc',
    filename: 'מדריך.pdf',
    kind: 'DOC',
    textStatus: 'PENDING',
    lesson: { module: { courseId: 'course-1' } },
  };

  it('extracts text, marks COMPLETED, invalidates the brain and re-indexes the lesson', async () => {
    db.attachment.findFirst.mockResolvedValue(ATT);
    transcribe.mockResolvedValue({ text: 'תוכן המסמך', inputTokens: 3, outputTokens: 2 });
    await runTranscriptionJob(job);
    expect(db.attachment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ extractedText: 'תוכן המסמך', textStatus: 'COMPLETED' }),
      }),
    );
    expect(invalidate).toHaveBeenCalledWith('course-1');
    expect(enqueueIndex).toHaveBeenCalledWith(TENANT, 'lesson-1');
  });

  it('fails permanently on an unsupported file', async () => {
    db.attachment.findFirst.mockResolvedValue({ ...ATT, filename: 'x.zip', kind: 'OTHER' });
    await expect(runTranscriptionJob(job)).rejects.toThrow('ATTACHMENT_UNSUPPORTED');
  });
});

// ── Pure helpers ────────────────────────────────────────────────────────────

describe('attachment helpers', () => {
  it('recognises readable files', () => {
    expect(attachmentReadable('a.pdf', 'DOC')).toBe(true);
    expect(attachmentReadable('צילום.jpeg', 'IMAGE')).toBe(true);
    expect(attachmentReadable('a.zip', 'DOC')).toBe(false);
    expect(attachmentReadable('a.pdf', 'OTHER')).toBe(false);
  });

  it('maps filenames to mime types', () => {
    expect(attachmentMime('a.pdf', 'DOC')).toBe('application/pdf');
    expect(attachmentMime('b.PNG', 'IMAGE')).toBe('image/png');
    expect(attachmentMime('no-ext', 'IMAGE')).toBe('image/jpeg');
  });
});
