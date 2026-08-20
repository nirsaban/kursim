import { Queue } from 'bullmq';
import { getQueueConnection } from '@/lib/ai/queue';

export const TRANSCRIPTION_QUEUE = 'transcription';

export type TranscriptionJob =
  | {
      tenantId: string;
      kind: 'lesson';
      id: string;
      /** Redo even if a transcript already exists (new video, explicit retry). */
      force?: boolean;
    }
  | {
      tenantId: string;
      kind: 'attachment';
      id: string;
      /** Redo even if extracted text already exists (explicit retry). */
      force?: boolean;
    }
  | {
      tenantId: string;
      /** Rebuild + atomically activate a lesson's knowledge chunks/embeddings. */
      kind: 'index';
      /** Lesson id. */
      id: string;
    };

let queue: Queue<TranscriptionJob> | null = null;

export function getTranscriptionQueue(): Queue<TranscriptionJob> {
  if (!queue) {
    queue = new Queue<TranscriptionJob>(TRANSCRIPTION_QUEUE, {
      connection: getQueueConnection(),
    }) as Queue<TranscriptionJob>;
  }
  return queue;
}

/**
 * Enqueue one transcription. jobId dedupes at the queue level — enqueueing a
 * lesson already waiting/active is a no-op instead of a second Gemini spend;
 * the service's status check is the second, DB-level guard.
 *
 * BullMQ's jobId dedup only helps while a job is pending — once one finishes
 * (completed OR failed) it lingers in Redis (removeOnComplete/removeOnFail
 * intentionally keep recent history), and add()'ing the same jobId again
 * silently hands back that finished job instead of starting a new one. That
 * would make every retry/reprocess request past the first a no-op, so a
 * previously-finished job under this id is removed first.
 */
export async function enqueueTranscription(job: TranscriptionJob): Promise<void> {
  const queue = getTranscriptionQueue();
  // BullMQ rejects ":" in a custom jobId (it's a reserved key delimiter).
  const jobId = `${job.kind}_${job.id}`;
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === 'completed' || state === 'failed') await existing.remove();
  }
  await queue.add('transcribe', job, {
    jobId,
    // Transient Gemini/Cloudinary failures retry with growing gaps (30s → 60s
    // → 120s); permanent ones throw UnrecoverableError in the service and stop.
    attempts: Number(process.env.TRANSCRIPTION_MAX_ATTEMPTS) || 3,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  });
}

/**
 * Rebuild a lesson's knowledge chunks/embeddings. jobId dedupes at the queue
 * level (same as lesson/attachment jobs) — a lesson already waiting to be
 * (re)indexed is a no-op instead of a second Gemini-embedding spend.
 */
export async function enqueueKnowledgeIndexing(tenantId: string, lessonId: string): Promise<void> {
  await enqueueTranscription({ tenantId, kind: 'index', id: lessonId });
}
