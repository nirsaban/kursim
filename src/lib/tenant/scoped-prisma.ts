import { prisma } from './prisma';

// Models that carry a tenantId column (must match prisma/schema.prisma and the RLS migration).
const TENANT_MODELS = new Set([
  'User',
  'Invite',
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
