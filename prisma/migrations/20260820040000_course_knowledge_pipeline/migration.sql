-- Course video knowledge pipeline: structured transcripts (with timestamped
-- segments + auto chapters), semantic knowledge chunks, embeddings and
-- pgvector-backed RAG retrieval for the mentor. Requires the postgres image
-- to be pgvector/pgvector:pg16 (see docker-compose.yml) — CREATE EXTENSION
-- needs a build that ships the vector extension files.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "KnowledgeVersionStatus" AS ENUM (
  'PENDING', 'CHUNKING', 'EMBEDDING', 'ACTIVATING', 'ACTIVE', 'SUPERSEDED', 'FAILED'
);
CREATE TYPE "KnowledgeChunkSource" AS ENUM ('VIDEO', 'ATTACHMENT');

-- ── Transcript / TranscriptSegment / Chapter ─────────────────────────────────

CREATE TABLE "Transcript" (
    "id"            UUID NOT NULL,
    "tenantId"      UUID NOT NULL,
    "lessonId"      UUID NOT NULL,
    "language"      TEXT NOT NULL,
    "text"          TEXT NOT NULL,
    "durationSec"   INTEGER,
    "provider"      TEXT NOT NULL DEFAULT 'gemini',
    "model"         TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Transcript_lessonId_key" ON "Transcript"("lessonId");
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TranscriptSegment" (
    "id"           UUID NOT NULL,
    "tenantId"     UUID NOT NULL,
    "transcriptId" UUID NOT NULL,
    "sequence"     INTEGER NOT NULL,
    "startSeconds" DOUBLE PRECISION NOT NULL,
    "endSeconds"   DOUBLE PRECISION NOT NULL,
    "text"         TEXT NOT NULL,
    CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TranscriptSegment_transcriptId_sequence_idx" ON "TranscriptSegment"("transcriptId", "sequence");
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Chapter" (
    "id"           UUID NOT NULL,
    "tenantId"     UUID NOT NULL,
    "transcriptId" UUID NOT NULL,
    "lessonId"     UUID NOT NULL,
    "title"        TEXT NOT NULL,
    "summary"      TEXT NOT NULL DEFAULT '',
    "startSeconds" DOUBLE PRECISION NOT NULL,
    "endSeconds"   DOUBLE PRECISION NOT NULL,
    "sequence"     INTEGER NOT NULL,
    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Chapter_transcriptId_sequence_idx" ON "Chapter"("transcriptId", "sequence");
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── KnowledgeVersion / KnowledgeChunk ─────────────────────────────────────────

CREATE TABLE "KnowledgeVersion" (
    "id"                UUID NOT NULL,
    "tenantId"          UUID NOT NULL,
    "courseId"          UUID NOT NULL,
    "lessonId"          UUID NOT NULL,
    "status"            "KnowledgeVersionStatus" NOT NULL DEFAULT 'PENDING',
    "processingVersion" INTEGER NOT NULL DEFAULT 1,
    "promptVersion"     TEXT,
    "embeddingModel"    TEXT,
    "embeddingDim"      INTEGER,
    "error"             TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt"       TIMESTAMP(3),
    "supersededAt"      TIMESTAMP(3),
    CONSTRAINT "KnowledgeVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KnowledgeVersion_lessonId_idx" ON "KnowledgeVersion"("lessonId");
CREATE INDEX "KnowledgeVersion_tenantId_courseId_status_idx" ON "KnowledgeVersion"("tenantId", "courseId", "status");
-- Only one ACTIVE knowledge version per lesson, ever — this is what makes
-- activation safe: the mentor only reads chunks whose version is ACTIVE, and
-- this index is what guarantees there is exactly zero or one such version.
-- Prisma cannot express a partial unique index, so it is hand-written here.
CREATE UNIQUE INDEX "KnowledgeVersion_lessonId_active_key" ON "KnowledgeVersion"("lessonId") WHERE "status" = 'ACTIVE';
ALTER TABLE "KnowledgeVersion" ADD CONSTRAINT "KnowledgeVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeVersion" ADD CONSTRAINT "KnowledgeVersion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeVersion" ADD CONSTRAINT "KnowledgeVersion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "KnowledgeChunk" (
    "id"                 UUID NOT NULL,
    "tenantId"           UUID NOT NULL,
    "courseId"           UUID NOT NULL,
    "lessonId"           UUID NOT NULL,
    "knowledgeVersionId" UUID NOT NULL,
    "sourceType"         "KnowledgeChunkSource" NOT NULL,
    "attachmentId"       UUID,
    "content"            TEXT NOT NULL,
    "sequence"           INTEGER NOT NULL,
    "startSeconds"       DOUBLE PRECISION,
    "endSeconds"         DOUBLE PRECISION,
    "metadata"           JSONB,
    "embeddingModel"     TEXT NOT NULL,
    -- pgvector column. text-embedding-004 (the default GEMINI_EMBEDDING_MODEL)
    -- outputs 768 dims; changing the model/dimension requires a new migration
    -- (never silently reinterpret existing vectors at a different width).
    "embedding"          vector(768),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KnowledgeChunk_tenantId_courseId_idx" ON "KnowledgeChunk"("tenantId", "courseId");
CREATE INDEX "KnowledgeChunk_knowledgeVersionId_idx" ON "KnowledgeChunk"("knowledgeVersionId");
-- No HNSW/IVFFlat vector index yet: at this dataset size (a handful of
-- lessons per course) a sequential scan over cosine distance is fast enough.
-- Add one (e.g. `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)`)
-- once a tenant's course chunk count makes a plain scan measurably slow.
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_knowledgeVersionId_fkey" FOREIGN KEY ("knowledgeVersionId") REFERENCES "KnowledgeVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── RLS + grants (same tenant_isolation pattern as every other tenant-owned table) ──

ALTER TABLE "Transcript" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Transcript" USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "Transcript" TO kursim_app;

ALTER TABLE "TranscriptSegment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TranscriptSegment" USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "TranscriptSegment" TO kursim_app;

ALTER TABLE "Chapter" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Chapter" USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "Chapter" TO kursim_app;

ALTER TABLE "KnowledgeVersion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "KnowledgeVersion" USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "KnowledgeVersion" TO kursim_app;

ALTER TABLE "KnowledgeChunk" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "KnowledgeChunk" USING (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.is_super', true) = 'true' OR "tenantId"::text = current_setting('app.tenant_id', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "KnowledgeChunk" TO kursim_app;
