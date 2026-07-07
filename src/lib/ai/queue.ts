import { Queue, type ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import type { CourseMediaJob } from './pipeline';

export const COURSE_MEDIA_QUEUE = 'course-media';

let connection: IORedis | null = null;
let queue: Queue<CourseMediaJob> | null = null;

/** Shared BullMQ Redis connection (separate from the app session Redis client). */
export function getQueueConnection(): ConnectionOptions {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null, // required by BullMQ
    });
  }
  return connection as unknown as ConnectionOptions;
}

/** Lazily-created producer used by the API route to enqueue a generation job. */
export function getCourseMediaQueue(): Queue<CourseMediaJob> {
  if (!queue) {
    queue = new Queue<CourseMediaJob>(COURSE_MEDIA_QUEUE, {
      connection: getQueueConnection(),
    }) as Queue<CourseMediaJob>;
  }
  return queue;
}

export async function enqueueCourseMedia(job: CourseMediaJob): Promise<void> {
  await getCourseMediaQueue().add('generate', job, {
    attempts: 1, // Veo is expensive — never silently retry a paid generation
    removeOnComplete: 50,
    removeOnFail: 100,
  });
}
