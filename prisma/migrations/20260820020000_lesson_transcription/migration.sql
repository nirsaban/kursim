-- Lesson video transcription: Gemini writes Lesson.transcript, which the AI
-- mentor already reads. Columns only — "Lesson" already has RLS and the
-- kursim_app grants, and neither is per-column.
CREATE TYPE "TranscriptStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "Lesson" ADD COLUMN "transcriptStatus" "TranscriptStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Lesson" ADD COLUMN "transcriptLang"   TEXT;
ALTER TABLE "Lesson" ADD COLUMN "transcriptError"  TEXT;
ALTER TABLE "Lesson" ADD COLUMN "transcribedAt"    TIMESTAMP(3);

-- A lesson that already carries a transcript (hand-written, or imported) is
-- done — the backfill must not re-transcribe it and spend on it again.
UPDATE "Lesson"
   SET "transcriptStatus" = 'COMPLETED',
       "transcriptLang"   = 'he',
       "transcribedAt"    = NOW()
 WHERE "transcript" IS NOT NULL AND btrim("transcript") <> '';

-- The backfill scans by status; without this it is a full table scan per run.
CREATE INDEX "Lesson_transcriptStatus_idx" ON "Lesson"("transcriptStatus");
