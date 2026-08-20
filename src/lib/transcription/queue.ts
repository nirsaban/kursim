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
 * lesson already waiting is a no-op instead of a second Gemini spend; the
 * service's status check is the second, DB-level guard.
 */
export async function enqueueTranscription(job: TranscriptionJob): Promise<void> {
  await getTranscriptionQueue().add('transcribe', job, {
    jobId: `${job.kind}:${job.id}`,
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
