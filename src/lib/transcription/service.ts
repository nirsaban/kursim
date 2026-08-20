import { UnrecoverableError } from 'bullmq';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { invalidateCourseBrain } from '@/lib/mentor';
import { runIndexJob } from '@/lib/knowledge/indexing';
import { enqueueTranscription, enqueueKnowledgeIndexing, type TranscriptionJob } from './queue';
import {
  transcriptionConfig,
  transcribeMedia,
  analyzeStructuredMedia,
  EXTRACT_PROMPT,
} from './gemini-stt';
import { LESSON_VIDEO_ANALYSIS_PROMPT_V1, LESSON_VIDEO_ANALYSIS_PROMPT_VERSION } from './prompts';
import { videoAnalysisSchema, VIDEO_ANALYSIS_RESPONSE_SCHEMA } from './schemas';
import {
  extractLessonAudio,
  fetchAttachmentBytes,
  attachmentMime,
  attachmentReadable,
} from './media';

/**
 * Lesson-video transcription + attachment text extraction, feeding the mentor
 * brain. Requests run in the web process (they only flip status and enqueue);
 * the actual Gemini work runs in the worker via runTranscriptionJob.
 *
 * State machine (Lesson.transcriptStatus / Attachment.textStatus):
 *   NONE → PENDING → PROCESSING → COMPLETED | FAILED
 * FAILED and (with force) COMPLETED re-enter at PENDING. PROCESSING is a
 * lock: a second job seeing it exits instead of double-spending on Gemini.
 */

/** Error codes that must not burn retries — the input itself is the problem. */
const PERMANENT = new Set([
  'LESSON_NOT_FOUND',
  'LESSON_VIDEO_NOT_FOUND',
  'ATTACHMENT_NOT_FOUND',
  'ATTACHMENT_UNSUPPORTED',
  'EMPTY_TRANSCRIPT',
  'TRANSCRIPTION_DISABLED',
  // Gemini returned JSON that doesn't match videoAnalysisSchema after
  // BullMQ's normal retry budget — never persisted, never guessed at.
  'TRANSCRIPT_SCHEMA_INVALID',
]);

/** Keep stored errors stable and safe — codes, never raw messages with URLs. */
function toErrorCode(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (PERMANENT.has(msg)) return msg;
  return 'TRANSCRIPTION_PROVIDER_ERROR';
}

export type RequestOutcome = 'queued' | 'skipped' | 'no_media' | 'disabled';

// ── Requests (web process) ───────────────────────────────────────────────────

export async function requestLessonTranscription(
  tenantId: string,
  lessonId: string,
  opts: { force?: boolean } = {},
): Promise<RequestOutcome> {
  if (!transcriptionConfig().enabled) return 'disabled';
  const db = forTenant(tenantId);
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId },
    select: { id: true, videoPublicId: true, transcriptStatus: true },
  });
  if (!lesson?.videoPublicId) return 'no_media';
  if (!opts.force && lesson.transcriptStatus !== 'NONE' && lesson.transcriptStatus !== 'FAILED') {
    return 'skipped';
  }
  await db.lesson.update({
    where: { id: lesson.id },
    data: { transcriptStatus: 'PENDING', transcriptError: null },
  });
  await enqueueTranscription({ tenantId, kind: 'lesson', id: lesson.id, force: opts.force });
  console.log(`[transcription] queued lesson=${lesson.id}`);
  return 'queued';
}

export async function requestAttachmentExtraction(
  tenantId: string,
  attachmentId: string,
  opts: { force?: boolean } = {},
): Promise<RequestOutcome> {
  if (!transcriptionConfig().enabled) return 'disabled';
  const db = forTenant(tenantId);
  const att = await db.attachment.findFirst({
    where: { id: attachmentId },
    select: { id: true, filename: true, kind: true, textStatus: true },
  });
  if (!att) return 'no_media';
  if (!attachmentReadable(att.filename, att.kind)) return 'no_media';
  if (!opts.force && att.textStatus !== 'NONE' && att.textStatus !== 'FAILED') return 'skipped';
  await db.attachment.update({
    where: { id: att.id },
    data: { textStatus: 'PENDING', textError: null },
  });
  await enqueueTranscription({ tenantId, kind: 'attachment', id: att.id, force: opts.force });
  console.log(`[transcription] queued attachment=${att.id}`);
  return 'queued';
}

/**
 * The sync button: enqueue everything in one course that has media but no
 * (successful) text yet — or everything, with force. Returns counts for the UI.
 */
export async function syncCourseTranscriptions(
  tenantId: string,
  courseId: string,
  opts: { force?: boolean } = {},
): Promise<{ lessonsQueued: number; attachmentsQueued: number }> {
  const db = forTenant(tenantId);
  const modules = await db.module.findMany({
    where: { courseId },
    select: {
      lessons: {
        select: {
          id: true,
          videoPublicId: true,
          transcriptStatus: true,
          attachments: { select: { id: true, filename: true, kind: true, textStatus: true } },
        },
      },
    },
  });
  let lessonsQueued = 0;
  let attachmentsQueued = 0;
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      if (lesson.videoPublicId) {
        const r = await requestLessonTranscription(tenantId, lesson.id, opts);
        if (r === 'queued') lessonsQueued++;
      }
      for (const att of lesson.attachments) {
        const r = await requestAttachmentExtraction(tenantId, att.id, opts);
        if (r === 'queued') attachmentsQueued++;
      }
    }
  }
  return { lessonsQueued, attachmentsQueued };
}

// ── Job execution (worker process) ───────────────────────────────────────────

export async function runTranscriptionJob(job: TranscriptionJob): Promise<void> {
  // Indexing (chunk + embed) is the same Gemini cost surface as transcription
  // itself — the TRANSCRIPTION_ENABLED off-switch pauses both together.
  if (!transcriptionConfig().enabled) throw new UnrecoverableError('TRANSCRIPTION_DISABLED');
  if (job.kind === 'index') return runIndexJob(job.tenantId, job.id);
  if (job.kind === 'lesson') return runLessonJob(job);
  return runAttachmentJob(job);
}

async function runLessonJob(job: Extract<TranscriptionJob, { kind: 'lesson' }>): Promise<void> {
  const db = forTenant(job.tenantId);
  const lesson = await db.lesson.findFirst({
    where: { id: job.id },
    select: {
      id: true,
      title: true,
      videoPublicId: true,
      videoProvider: true,
      durationSec: true,
      transcriptStatus: true,
      module: { select: { courseId: true } },
    },
  });
  if (!lesson) throw new UnrecoverableError('LESSON_NOT_FOUND');
  if (!lesson.videoPublicId) {
    await db.lesson.update({
      where: { id: lesson.id },
      data: { transcriptStatus: 'FAILED', transcriptError: 'LESSON_VIDEO_NOT_FOUND' },
    });
    throw new UnrecoverableError('LESSON_VIDEO_NOT_FOUND');
  }
  if (lesson.transcriptStatus === 'COMPLETED' && !job.force) return; // idempotent

  // PROCESSING is a compare-and-set lock: 0 rows updated → someone else runs.
  const claimed = await db.lesson.updateMany({
    where: { id: lesson.id, transcriptStatus: { not: 'PROCESSING' } },
    data: { transcriptStatus: 'PROCESSING', transcriptError: null },
  });
  if (claimed.count === 0) {
    console.log(`[transcription] lesson=${lesson.id} already processing, exiting`);
    return;
  }

  const startedAt = Date.now();
  try {
    const { audio, cleanup } = await extractLessonAudio(
      lesson.videoPublicId,
      lesson.videoProvider,
    );
    let structured;
    try {
      structured = await analyzeStructuredMedia(
        audio,
        'audio/mp3',
        `lesson-${lesson.id}`,
        LESSON_VIDEO_ANALYSIS_PROMPT_V1,
        VIDEO_ANALYSIS_RESPONSE_SCHEMA,
      );
    } finally {
      await cleanup();
    }
    const parsed = videoAnalysisSchema.safeParse(structured.data);
    if (!parsed.success) {
      console.error(
        `[transcription] schema_invalid lesson=${lesson.id}: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      );
      throw new Error('TRANSCRIPT_SCHEMA_INVALID'); // retryable — a transient bad generation, not a permanent input problem
    }
    const analysis = parsed.data;
    const joinedText = analysis.transcript.map((s) => s.text).join('\n\n');
    if (!joinedText || joinedText.length < 10) throw new UnrecoverableError('EMPTY_TRANSCRIPT');

    const { model: geminiModel } = transcriptionConfig();
    const transcript = await db.transcript.upsert({
      where: { lessonId: lesson.id },
      update: {
        language: analysis.language,
        text: joinedText,
        durationSec: lesson.durationSec,
        model: geminiModel,
        promptVersion: LESSON_VIDEO_ANALYSIS_PROMPT_VERSION,
      },
      create: {
        tenantId: job.tenantId,
        lessonId: lesson.id,
        language: analysis.language,
        text: joinedText,
        durationSec: lesson.durationSec,
        model: geminiModel,
        promptVersion: LESSON_VIDEO_ANALYSIS_PROMPT_VERSION,
      },
    });
    // Wholesale replace: segments/chapters are fully regenerated each run,
    // never appended to (mirrors the existing overwrite-in-place transcript contract).
    await db.transcriptSegment.deleteMany({ where: { transcriptId: transcript.id } });
    await db.chapter.deleteMany({ where: { transcriptId: transcript.id } });
    await db.transcriptSegment.createMany({
      data: analysis.transcript.map((s, i) => ({
        tenantId: job.tenantId,
        transcriptId: transcript.id,
        sequence: i,
        startSeconds: s.startSeconds,
        endSeconds: s.endSeconds,
        text: s.text,
      })),
    });
    if (analysis.chapters.length > 0) {
      await db.chapter.createMany({
        data: analysis.chapters.map((c, i) => ({
          tenantId: job.tenantId,
          transcriptId: transcript.id,
          lessonId: lesson.id,
          title: c.title,
          summary: c.summary,
          startSeconds: c.startSeconds,
          endSeconds: c.endSeconds,
          sequence: i,
        })),
      });
    }

    await db.lesson.update({
      where: { id: lesson.id },
      data: {
        transcript: joinedText,
        transcriptStatus: 'COMPLETED',
        transcriptLang: analysis.language,
        transcriptError: null,
        transcribedAt: new Date(),
      },
    });
    await invalidateCourseBrain(lesson.module.courseId).catch(() => {});
    console.log(
      `[transcription] completed lesson=${lesson.id} chars=${joinedText.length}` +
        ` segments=${analysis.transcript.length} chapters=${analysis.chapters.length}` +
        ` videoSec=${lesson.durationSec ?? '?'} tookMs=${Date.now() - startedAt}` +
        ` tokens=${structured.inputTokens}/${structured.outputTokens}`,
    );
    // Chunking/embedding/activation happens in the worker's own job — enqueue,
    // don't inline it here, so a Gemini/embedding hiccup never re-runs the
    // (already-paid-for) transcription above.
    await enqueueKnowledgeIndexing(job.tenantId, lesson.id);
  } catch (e) {
    await db.lesson
      .update({
        where: { id: lesson.id },
        data: { transcriptStatus: 'FAILED', transcriptError: toErrorCode(e) },
      })
      .catch(() => {});
    console.error(`[transcription] failed lesson=${lesson.id}: ${toErrorCode(e)}`);
    throw e; // BullMQ decides: retry, unless UnrecoverableError
  }
}

async function runAttachmentJob(job: Extract<TranscriptionJob, { kind: 'attachment' }>): Promise<void> {
  const db = forTenant(job.tenantId);
  const att = await db.attachment.findFirst({
    where: { id: job.id },
    select: {
      id: true,
      lessonId: true,
      publicId: true,
      filename: true,
      kind: true,
      textStatus: true,
      lesson: { select: { module: { select: { courseId: true } } } },
    },
  });
  if (!att) throw new UnrecoverableError('ATTACHMENT_NOT_FOUND');
  if (!attachmentReadable(att.filename, att.kind)) {
    await db.attachment.update({
      where: { id: att.id },
      data: { textStatus: 'FAILED', textError: 'ATTACHMENT_UNSUPPORTED' },
    });
    throw new UnrecoverableError('ATTACHMENT_UNSUPPORTED');
  }
  if (att.textStatus === 'COMPLETED' && !job.force) return;

  const claimed = await db.attachment.updateMany({
    where: { id: att.id, textStatus: { not: 'PROCESSING' } },
    data: { textStatus: 'PROCESSING', textError: null },
  });
  if (claimed.count === 0) {
    console.log(`[transcription] attachment=${att.id} already processing, exiting`);
    return;
  }

  const startedAt = Date.now();
  try {
    const bytes = await fetchAttachmentBytes(att.publicId, att.kind);
    const mime = attachmentMime(att.filename, att.kind);
    const result = await transcribeMedia(bytes, mime, `attachment-${att.id}`, EXTRACT_PROMPT);
    if (!result.text || result.text.length < 2) throw new UnrecoverableError('EMPTY_TRANSCRIPT');

    await db.attachment.update({
      where: { id: att.id },
      data: {
        extractedText: result.text,
        textStatus: 'COMPLETED',
        textError: null,
        extractedAt: new Date(),
      },
    });
    await invalidateCourseBrain(att.lesson.module.courseId).catch(() => {});
    console.log(
      `[transcription] completed attachment=${att.id} chars=${result.text.length}` +
        ` tookMs=${Date.now() - startedAt} tokens=${result.inputTokens}/${result.outputTokens}`,
    );
    // The lesson's knowledge chunks now need this attachment's text folded in.
    await enqueueKnowledgeIndexing(job.tenantId, att.lessonId);
  } catch (e) {
    await db.attachment
      .update({
        where: { id: att.id },
        data: { textStatus: 'FAILED', textError: toErrorCode(e) },
      })
      .catch(() => {});
    console.error(`[transcription] failed attachment=${att.id}: ${toErrorCode(e)}`);
    throw e;
  }
}
