/**
 * The one place in the app that touches KnowledgeChunk.embedding directly.
 * Prisma has no client API for pgvector's `vector` type or its distance
 * operators, so every insert/query against that column is raw, parametrized
 * SQL, isolated here. tenantId/courseId are always bound parameters supplied
 * by the caller (never client input, never string-concatenated) — this is on
 * top of, not instead of, the RLS session var set by runInTenantTransaction.
 */
import { randomUUID } from 'node:crypto';
import { runInTenantTransaction } from '@/lib/tenant/scoped-prisma';
import type { ChunkDraft } from './chunking';

export interface ChunkToPersist extends ChunkDraft {
  embedding: number[];
}

export interface ActivateKnowledgeVersionInput {
  tenantId: string;
  courseId: string;
  lessonId: string;
  knowledgeVersionId: string;
  embeddingModel: string;
  chunks: ChunkToPersist[];
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Insert every chunk (with its embedding) for a version and atomically flip
 * it ACTIVE, superseding whatever was previously ACTIVE for this lesson —
 * all in one transaction. If this throws, nothing commits: the previous
 * ACTIVE version (and its chunks) stays untouched and keeps serving the
 * mentor. Never call this until every chunk has a valid embedding.
 */
export async function persistChunksAndActivate(input: ActivateKnowledgeVersionInput): Promise<void> {
  const { tenantId, courseId, lessonId, knowledgeVersionId, embeddingModel, chunks } = input;
  await runInTenantTransaction(tenantId, async (tx) => {
    for (const chunk of chunks) {
      const metadataJson = chunk.metadata ? JSON.stringify(chunk.metadata) : null;
      await tx.$executeRaw`
        INSERT INTO "KnowledgeChunk"
          ("id", "tenantId", "courseId", "lessonId", "knowledgeVersionId", "sourceType",
           "attachmentId", "content", "sequence", "startSeconds", "endSeconds", "metadata",
           "embeddingModel", "embedding", "createdAt")
        VALUES
          (${randomUUID()}::uuid, ${tenantId}::uuid, ${courseId}::uuid, ${lessonId}::uuid,
           ${knowledgeVersionId}::uuid, ${chunk.sourceType}::"KnowledgeChunkSource",
           ${chunk.attachmentId ?? null}::uuid, ${chunk.content}, ${chunk.sequence},
           ${chunk.startSeconds ?? null}, ${chunk.endSeconds ?? null}, ${metadataJson}::jsonb,
           ${embeddingModel}, ${toVectorLiteral(chunk.embedding)}::vector, now())
      `;
    }

    await tx.$executeRaw`
      UPDATE "KnowledgeVersion"
         SET "status" = 'SUPERSEDED', "supersededAt" = now()
       WHERE "lessonId" = ${lessonId}::uuid AND "status" = 'ACTIVE' AND "id" != ${knowledgeVersionId}::uuid
    `;
    await tx.$executeRaw`
      UPDATE "KnowledgeVersion"
         SET "status" = 'ACTIVE', "activatedAt" = now()
       WHERE "id" = ${knowledgeVersionId}::uuid
    `;
  });
}

/** Remove any chunks a failed/retried indexing attempt already wrote for this version, before rebuilding it. */
export async function deleteChunksForVersion(tenantId: string, knowledgeVersionId: string): Promise<void> {
  await runInTenantTransaction(tenantId, (tx) =>
    tx.$executeRaw`DELETE FROM "KnowledgeChunk" WHERE "knowledgeVersionId" = ${knowledgeVersionId}::uuid`,
  );
}

export interface ChunkSearchResult {
  content: string;
  lessonId: string;
  lessonTitle: string;
  startSeconds: number | null;
  endSeconds: number | null;
  metadata: unknown;
  score: number;
}

/**
 * Cosine-similarity search over ACTIVE chunks only, scoped to one tenant +
 * course (both bound params — never trust a client-supplied tenantId).
 */
export async function searchActiveChunks(
  tenantId: string,
  courseId: string,
  queryEmbedding: number[],
  limit: number,
): Promise<ChunkSearchResult[]> {
  const vectorLiteral = toVectorLiteral(queryEmbedding);
  return runInTenantTransaction(tenantId, (tx) =>
    tx.$queryRaw<ChunkSearchResult[]>`
      SELECT
        kc."content"       AS "content",
        kc."lessonId"      AS "lessonId",
        l."title"          AS "lessonTitle",
        kc."startSeconds"  AS "startSeconds",
        kc."endSeconds"    AS "endSeconds",
        kc."metadata"      AS "metadata",
        1 - (kc."embedding" <=> ${vectorLiteral}::vector) AS "score"
      FROM "KnowledgeChunk" kc
      JOIN "KnowledgeVersion" kv ON kv."id" = kc."knowledgeVersionId" AND kv."status" = 'ACTIVE'
      JOIN "Lesson" l ON l."id" = kc."lessonId"
      WHERE kc."tenantId" = ${tenantId}::uuid AND kc."courseId" = ${courseId}::uuid
      ORDER BY kc."embedding" <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `,
  );
}
