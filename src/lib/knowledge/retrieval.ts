import { getEmbeddingProvider } from '@/lib/ai/embeddings';
import { searchActiveChunks } from './chunk-repository';

export interface KnowledgeSearchResult {
  content: string;
  lessonId: string;
  lessonTitle: string;
  startSeconds: number | null;
  endSeconds: number | null;
  metadata: unknown;
  score: number;
}

export interface CourseKnowledgeRetriever {
  search(params: {
    tenantId: string;
    courseId: string;
    query: string;
    limit?: number;
  }): Promise<KnowledgeSearchResult[]>;
}

const DEFAULT_TOP_K = Number(process.env.RAG_TOP_K) || 6;

/**
 * Embeds the question, then runs a tenant+course-scoped pgvector similarity
 * search over ACTIVE knowledge chunks only. tenantId must come from the
 * authenticated session (mentor.ts passes the tenant it already resolved
 * the student/course under) — never from user-supplied input.
 */
export const pgvectorRetriever: CourseKnowledgeRetriever = {
  async search({ tenantId, courseId, query, limit = DEFAULT_TOP_K }) {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const embedding = await getEmbeddingProvider().embed(trimmed);
    return searchActiveChunks(tenantId, courseId, embedding, limit);
  },
};
