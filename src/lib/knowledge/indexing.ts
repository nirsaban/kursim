import { UnrecoverableError } from 'bullmq';
import type { KnowledgeVersionStatus } from '@prisma/client';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getEmbeddingProvider, embeddingConfig, EMBEDDING_DIM } from '@/lib/ai/embeddings';
import { buildLessonChunks } from './chunking';
import { persistChunksAndActivate, deleteChunksForVersion } from './chunk-repository';

/**
 * Rebuilds one lesson's knowledge (chunks + embeddings) from its current
 * structured transcript + attachments, and atomically activates the result.
 * Triggered after a lesson transcription completes OR an attachment
 * extraction completes (see service.ts) — both funnel into this one job kind
 * (`{kind:'index'}`) on the existing `transcription` queue.
 *
 * Idempotent: BullMQ's jobId dedup (`index:{lessonId}`) is the primary guard
 * against duplicate delivery. A retried/resumed attempt reuses whatever
 * non-terminal KnowledgeVersion already exists for this lesson instead of
 * creating a second one; a version only becomes visible to the mentor once
 * persistChunksAndActivate flips it ACTIVE, so a crash mid-run never exposes
 * partial knowledge — the previously ACTIVE version keeps serving.
 */
const NON_TERMINAL: KnowledgeVersionStatus[] = ['PENDING', 'CHUNKING', 'EMBEDDING', 'ACTIVATING'];

const PERMANENT = new Set(['LESSON_NOT_FOUND', 'NO_KNOWLEDGE_SOURCE']);

function toErrorCode(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (PERMANENT.has(msg)) return msg;
  return 'KNOWLEDGE_INDEXING_ERROR';
}

export async function runIndexJob(tenantId: string, lessonId: string): Promise<void> {
  const db = forTenant(tenantId);
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId },
    select: {
      id: true,
      module: { select: { courseId: true } },
      structuredTranscript: {
        select: {
          segments: {
            orderBy: { sequence: 'asc' },
            select: { startSeconds: true, endSeconds: true, text: true },
          },
          chapters: {
            orderBy: { sequence: 'asc' },
            select: { title: true, startSeconds: true, endSeconds: true },
          },
        },
      },
      attachments: {
        where: { textStatus: 'COMPLETED' },
        select: { id: true, filename: true, extractedText: true },
      },
    },
  });
  if (!lesson) throw new UnrecoverableError('LESSON_NOT_FOUND');
  const courseId = lesson.module.courseId;

  const segments = lesson.structuredTranscript?.segments ?? [];
  const chapters = lesson.structuredTranscript?.chapters ?? [];
  const attachments = lesson.attachments
    .filter((a): a is typeof a & { extractedText: string } => Boolean(a.extractedText))
    .map((a) => ({ attachmentId: a.id, filename: a.filename, text: a.extractedText }));

  if (segments.length === 0 && attachments.length === 0) return; // nothing to index yet

  let version = await db.knowledgeVersion.findFirst({
    where: { lessonId, status: { in: NON_TERMINAL } },
    orderBy: { createdAt: 'desc' },
  });
  if (version) {
    // Resuming a retried attempt: this version never went ACTIVE, so nothing
    // public depends on whatever chunks a previous attempt already wrote for
    // it — drop them before rebuilding from scratch.
    await deleteChunksForVersion(tenantId, version.id);
  } else {
    version = await db.knowledgeVersion.create({
      data: { tenantId, courseId, lessonId, status: 'PENDING' },
    });
  }

  console.log(
    `[knowledge] indexing_started tenant=${tenantId} course=${courseId} lesson=${lessonId} version=${version.id}`,
  );

  try {
    await db.knowledgeVersion.update({ where: { id: version.id }, data: { status: 'CHUNKING', error: null } });
    const drafts = buildLessonChunks({ segments, chapters, attachments });
    if (drafts.length === 0) throw new UnrecoverableError('NO_KNOWLEDGE_SOURCE');
    console.log(
      `[knowledge] chunks_created lesson=${lessonId} version=${version.id} count=${drafts.length}`,
    );

    await db.knowledgeVersion.update({ where: { id: version.id }, data: { status: 'EMBEDDING' } });
    console.log(`[knowledge] embeddings_started lesson=${lessonId} version=${version.id}`);
    const vectors = await getEmbeddingProvider().embedBatch(drafts.map((d) => d.content));
    console.log(`[knowledge] embeddings_completed lesson=${lessonId} version=${version.id}`);

    const { model: embeddingModel } = embeddingConfig();
    await db.knowledgeVersion.update({
      where: { id: version.id },
      data: { status: 'ACTIVATING', embeddingModel, embeddingDim: EMBEDDING_DIM },
    });
    await persistChunksAndActivate({
      tenantId,
      courseId,
      lessonId,
      knowledgeVersionId: version.id,
      embeddingModel,
      chunks: drafts.map((d, i) => ({ ...d, embedding: vectors[i] })),
    });
    console.log(`[knowledge] knowledge_activated lesson=${lessonId} version=${version.id}`);
  } catch (e) {
    if (e instanceof UnrecoverableError) {
      await db.knowledgeVersion
        .update({ where: { id: version.id }, data: { status: 'FAILED', error: e.message } })
        .catch(() => {});
      throw e;
    }
    const code = toErrorCode(e);
    await db.knowledgeVersion
      .update({ where: { id: version.id }, data: { status: 'FAILED', error: code } })
      .catch(() => {});
    console.error(`[knowledge] knowledge_failed lesson=${lessonId} version=${version.id}: ${code}`);
    throw e; // BullMQ decides: retry, unless UnrecoverableError
  }
}
