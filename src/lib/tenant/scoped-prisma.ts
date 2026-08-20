import { prisma } from './prisma';

// Models that carry a tenantId column (must match prisma/schema.prisma and the RLS migration).
const TENANT_MODELS = new Set([
  'User',
  'Invite',
  'AuthToken',
  'Course',
  'Module',
  'Lesson',
  'Attachment',
  'Enrollment',
  'Progress',
  'CourseReview',
  'AffiliateLink',
  'CourseMedia',
  'LearningActivity',
  'Notification',
  'Broadcast',
  'CommunityPost',
  'CommunityReply',
  'LessonQuestion',
  'AccessCode',
  'Certificate',
  'LessonNote',
  'Wishlist',
  'Purchase',
  'PaymentOrder',
  'WhatsappMessage',
  'EmailAutomation',
  'AutomationSend',
  'ApiKey',
  'MentorUsage',
  'Transcript',
  'TranscriptSegment',
  'Chapter',
  'KnowledgeVersion',
  'KnowledgeChunk',
]);

const WHERE_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'updateMany',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

/* eslint-disable @typescript-eslint/no-explicit-any */
function injectTenant(model: string, operation: string, args: any, tenantId: string): any {
  if (!TENANT_MODELS.has(model)) return args;
  const a = { ...(args ?? {}) };
  if (WHERE_OPS.has(operation)) {
    a.where = { AND: [{ tenantId }, a.where ?? {}] };
  }
  if (operation === 'create') {
    a.data = { ...a.data, tenantId };
  }
  if (operation === 'createMany') {
    a.data = (Array.isArray(a.data) ? a.data : [a.data]).map((d: any) => ({ ...d, tenantId }));
  }
  if (operation === 'upsert') {
    a.create = { ...a.create, tenantId };
  }
  return a;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export { injectTenant };

/**
 * Layer 1: query-extension injects tenantId into reads/creates.
 * Layer 2: every operation runs in a transaction that sets app.tenant_id,
 * so Postgres RLS independently filters rows even if layer 1 misses
 * (e.g. findUnique/update/delete by id).
 */
export function forTenant(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const scoped = injectTenant(model, operation, args, tenantId);
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, TRUE), set_config('app.is_super', 'false', TRUE)`,
            query(scoped),
          ]);
          return result;
        },
      },
    },
  });
}

/** Non-tenant-scoped client for the super-admin code path only. */
export function asSuperAdmin() {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.is_super', 'true', TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof forTenant>;
export type SuperClient = ReturnType<typeof asSuperAdmin>;

/**
 * Interactive transaction for the handful of call sites that need raw SQL
 * (pgvector — Prisma has no client API for the `vector` type/operators).
 * Sets app.tenant_id first, same as forTenant()'s per-call transaction, then
 * hands back a tx handle so multiple raw statements can share one atomic
 * transaction. tenantId must always be bound as a query parameter inside
 * `fn`, never string-concatenated — this only adds the RLS belt to that
 * explicit-filter suspenders, it is not a substitute for it.
 */
export async function runInTenantTransaction<T>(
  tenantId: string,
  fn: (tx: Omit<typeof prisma, '$transaction' | '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, TRUE), set_config('app.is_super', 'false', TRUE)`;
    return fn(tx);
  });
}
