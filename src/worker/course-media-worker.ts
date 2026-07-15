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
