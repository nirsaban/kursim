import type { TenantClient } from '@/lib/tenant/scoped-prisma';

export type NotificationType =
  | 'broadcast'
  | 'qa_answer'
  | 'qa_question'
  | 'community_reply'
  | 'review'
  | 'certificate'
  | 'enroll';

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string | null;
}

/** Create one in-app notification for a single user. */
export async function notify(db: TenantClient, tenantId: string, n: NotifyInput): Promise<void> {
  await db.notification.create({
    data: {
      tenantId,
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body ?? '',
      link: n.link ?? null,
    },
  });
}

/** Fan one notification out to many users (broadcasts). Returns how many were sent. */
export async function notifyMany(
  db: TenantClient,
  tenantId: string,
  userIds: string[],
  n: Omit<NotifyInput, 'userId'>,
): Promise<number> {
  const ids = Array.from(new Set(userIds));
  if (ids.length === 0) return 0;
  await db.notification.createMany({
    data: ids.map((userId) => ({
      tenantId,
      userId,
      type: n.type,
      title: n.title,
      body: n.body ?? '',
      link: n.link ?? null,
    })),
  });
  return ids.length;
}
