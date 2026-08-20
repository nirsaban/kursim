import { Queue } from 'bullmq';
import { getQueueConnection } from '@/lib/ai/queue';
import type { NormalizeJob } from './normalize';

export const NORMALIZE_QUEUE = 'video-normalize';

let queue: Queue<NormalizeJob> | null = null;

export function getNormalizeQueue(): Queue<NormalizeJob> {
  if (!queue) {
    queue = new Queue<NormalizeJob>(NORMALIZE_QUEUE, {
      connection: getQueueConnection(),
    }) as Queue<NormalizeJob>;
  }
  return queue;
}

export async function enqueueNormalize(job: NormalizeJob): Promise<void> {
  await getNormalizeQueue().add('normalize', job, {
    jobId: `lesson:${job.lessonId}:${job.key}`,
    attempts: 2,
    backoff: { type: 'exponential', delay: 60_000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  });
}
