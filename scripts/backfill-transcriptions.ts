/**
 * One-shot backfill: queue transcription for every lesson video and readable
 * attachment uploaded before the pipeline existed. Idempotent — anything
 * COMPLETED/PENDING/PROCESSING is skipped, so re-running is always safe.
 *
 *   npm run transcribe:backfill            # everything missing
 *   npm run transcribe:backfill -- --dry   # count only, queue nothing
 *
 * Walks tenant by tenant through the scoped client (Lesson/Attachment sit
 * behind RLS — the raw client sees no rows). It only ENQUEUES; the worker does
 * the Gemini work at its own concurrency (TRANSCRIPTION_CONCURRENCY, default
 * 2) — that's where the "don't process a thousand videos at once" control is.
 */
import { prisma } from '@/lib/tenant/prisma';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import {
  requestLessonTranscription,
  requestAttachmentExtraction,
} from '@/lib/transcription/service';
import { attachmentReadable } from '@/lib/transcription/media';

const dry = process.argv.includes('--dry');

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
  let found = 0;
  let queued = 0;

  for (const tenant of tenants) {
    const db = forTenant(tenant.id);
    const lessons = await db.lesson.findMany({
      where: { videoPublicId: { not: null }, transcriptStatus: { in: ['NONE', 'FAILED'] } },
      select: { id: true },
    });
    const attachments = await db.attachment.findMany({
      where: { textStatus: { in: ['NONE', 'FAILED'] } },
      select: { id: true, filename: true, kind: true },
    });
    const readable = attachments.filter((a) => attachmentReadable(a.filename, a.kind));
    if (lessons.length + readable.length === 0) continue;

    found += lessons.length + readable.length;
    console.log(
      `[backfill] ${tenant.slug}: lessons=${lessons.length} attachments=${readable.length}`,
    );
    if (dry) continue;

    for (const l of lessons) {
      if ((await requestLessonTranscription(tenant.id, l.id)) === 'queued') queued++;
    }
    for (const a of readable) {
      if ((await requestAttachmentExtraction(tenant.id, a.id)) === 'queued') queued++;
    }
  }

  console.log(
    dry
      ? `[backfill] dry run — ${found} items would be queued`
      : `[backfill] queued=${queued} of ${found} — the worker takes it from here`,
  );
}

main()
  .catch((e) => {
    console.error('[backfill] failed:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
