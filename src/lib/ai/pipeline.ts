import { forTenant } from '@/lib/tenant/scoped-prisma';
import type { CourseMediaInputs } from './prompt';
import {
  writeMediaPrompt,
  generateVeoVideo,
  pollVeoOperation,
  downloadFile,
  generateImage,
} from './gemini';
import { extractFrames } from './frames';
import { publishCourseMedia } from './publish';

export interface CourseMediaJob {
  tenantId: string;
  courseId: string;
  inputs: CourseMediaInputs;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const VEO_TIMEOUT_MS = 10 * 60 * 1000;
const VEO_POLL_MS = 10 * 1000;

/**
 * Full generation pipeline for one course (runs in the worker):
 * prompt → Veo video (poll) → download → 240 frames → Imagen stills →
 * Cloudinary publish → mark ready. Any failure marks the row failed.
 */
export async function runCourseMediaJob(job: CourseMediaJob): Promise<void> {
  const db = forTenant(job.tenantId);
  const where = { courseId: job.courseId };
  try {
    const plan = await writeMediaPrompt(job.inputs);
    await db.courseMedia.update({ where, data: { promptJson: plan, status: 'generating', error: null } });

    const opName = await generateVeoVideo(plan.video);
    const started = Date.now();
    let result = await pollVeoOperation(opName);
    while (!result.done) {
      if (Date.now() - started > VEO_TIMEOUT_MS) throw new Error('Veo generation timed out');
      await sleep(VEO_POLL_MS);
      result = await pollVeoOperation(opName);
    }

    const mp4 = result.bytesBase64
      ? Buffer.from(result.bytesBase64, 'base64')
      : await downloadFile(result.fileUri!);

    const frames = await extractFrames(mp4);
    try {
      const images = await Promise.all(plan.stills.map((s) => generateImage(s)));
      const published = await publishCourseMedia(job.tenantId, job.courseId, { frames, images });
      await db.courseMedia.update({
        where,
        data: {
          status: 'ready',
          videoUrl: published.videoUrl,
          framesBaseUrl: published.framesBaseUrl,
          frameCount: published.frameCount,
          posterUrl: published.posterUrl,
          stills: published.stills,
          error: null,
        },
      });
    } finally {
      await frames.cleanup();
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.courseMedia
      .update({ where, data: { status: 'failed', error: message.slice(0, 1000) } })
      .catch(() => {});
    throw e;
  }
}
