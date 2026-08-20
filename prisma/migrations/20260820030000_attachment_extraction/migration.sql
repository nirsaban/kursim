-- Attachment text extraction (PDF text / image OCR via Gemini) feeding the
-- mentor brain — mirrors the Lesson transcription columns. "Attachment"
-- already has RLS and the kursim_app grants; columns only.
ALTER TABLE "Attachment" ADD COLUMN "extractedText" TEXT;
ALTER TABLE "Attachment" ADD COLUMN "textStatus" "TranscriptStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Attachment" ADD COLUMN "textError" TEXT;
ALTER TABLE "Attachment" ADD COLUMN "extractedAt" TIMESTAMP(3);

CREATE INDEX "Attachment_textStatus_idx" ON "Attachment"("textStatus");
