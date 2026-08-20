/**
 * Background worker for AI course-media generation. Run as its own process:
 *   npm run worker
 * It consumes the `course-media` BullMQ queue and runs the full Gemini pipeline
 * (prompt → Veo → frames → Imagen → Cloudinary). Veo takes minutes, so this must
 * NOT run inside the web request.
 */
import { Worker } from 'bullmq';
import { COURSE_MEDIA_QUEUE, getQueueConnection } from '@/lib/ai/queue';
import { runCourseMediaJob, type CourseMediaJob } from '@/lib/ai/pipeline';
import { TRANSCRIPTION_QUEUE, type TranscriptionJob } from '@/lib/transcription/queue';
import { NORMALIZE_QUEUE } from '@/lib/media-store/normalize-queue';
import { runNormalizeJob, type NormalizeJob } from '@/lib/media-store/normalize';
import { runTranscriptionJob } from '@/lib/transcription/service';
import { startWhatsappGateway } from './whatsapp-gateway';

// WhatsApp gateway (platform login-delivery number). Isolated: its own failures
// are swallowed inside startWhatsappGateway and never take down the media worker.
void startWhatsappGateway();

const worker = new Worker<CourseMediaJob>(
  COURSE_MEDIA_QUEUE,
  async (job) => {
    console.log(`[course-media] start course=${job.data.courseId} tenant=${job.data.tenantId}`);
    await runCourseMediaJob(job.data);
    console.log(`[course-media] done  course=${job.data.courseId}`);
  },
  {
    connection: getQueueConnection(),
    concurrency: 1, // one heavy Veo generation at a time
  },
);

worker.on('failed', (job, err) => {
  console.error(`[course-media] FAILED course=${job?.data.courseId}: ${err.message}`);
});

console.log('[course-media] worker ready, waiting for jobs…');

// Lesson/attachment transcription (Gemini STT + doc reading). Cheap enough to
// run a couple in parallel; keep it modest so a big backfill can't hammer
// Gemini rate limits or saturate the box ffmpeg-ing several videos at once.
const transcriptionWorker = new Worker<TranscriptionJob>(
  TRANSCRIPTION_QUEUE,
  async (job) => {
    console.log(`[transcription] start ${job.data.kind}=${job.data.id} attempt=${job.attemptsMade + 1}`);
    await runTranscriptionJob(job.data);
  },
  {
    connection: getQueueConnection(),
    concurrency: Number(process.env.TRANSCRIPTION_CONCURRENCY) || 2,
  },
);

transcriptionWorker.on('failed', (job, err) => {
  console.error(`[transcription] FAILED ${job?.data.kind}=${job?.data.id}: ${err.message}`);
});

// LOCAL lesson videos are normalized to streamable H.264 MP4 before anything
// else touches them. concurrency 1: one x264 encode already saturates a core,
// and this box hosts more than us.
const normalizeWorker = new Worker<NormalizeJob>(
  NORMALIZE_QUEUE,
  async (job) => {
    await runNormalizeJob(job.data);
  },
  { connection: getQueueConnection(), concurrency: 1 },
);

normalizeWorker.on('failed', (job, err) => {
  console.error(`[normalize] FAILED lesson=${job?.data.lessonId}: ${err.message}`);
});

console.log('[normalize] worker ready, waiting for jobs…');

console.log('[transcription] worker ready, waiting for jobs…');
