import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { he } from '@/lib/he';
import { relativeHe } from '@/lib/relative-time';

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const notifications = await forTenant(auth.tenantId!).notification.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="max-w-2xl">
      <PageHeader title={he.notifications} />

      {notifications.length === 0 ? (
        <EmptyState icon="🔔" title={he.notificationsEmpty} />
      ) : (
        <Card>
          <ul className="divide-y divide-line/70">
            {notifications.map((n) => {
              const inner = (
                <div className="flex items-start gap-3 px-5 py-4">
                  <span
                    className={
                      n.readAt
                        ? 'mt-2 w-2 h-2 rounded-full shrink-0 bg-transparent'
                        : 'mt-2 w-2 h-2 rounded-full shrink-0 bg-copper-500'
                    }
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{n.title}</p>
                    {n.body && (
                      <p className="text-sm text-muted mt-1 leading-relaxed">{n.body}</p>
                    )}
                    <p className="text-xs text-muted/70 mt-1.5">
                      {relativeHe(n.createdAt.getTime())}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link href={n.link} className="block hover:bg-paper/60 transition-colors">
                      {inner}
                    </Link>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
