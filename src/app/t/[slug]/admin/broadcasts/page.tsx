import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import BroadcastComposer from '@/components/admin/BroadcastComposer';
import { he } from '@/lib/he';
import { relativeHe } from '@/lib/relative-time';

export default async function AdminBroadcastsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}`);

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const db = forTenant(auth.tenantId!);
  const [courses, broadcasts] = await Promise.all([
    db.course.findMany({ select: { id: true, title: true } }),
    db.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader
        kicker={he.admin}
        title={he.broadcasts}
        subtitle={he.broadcastsSubtitle}
      />

      <BroadcastComposer courses={courses} />

      {broadcasts.length === 0 ? (
        <EmptyState icon="📣" title={he.broadcastsEmpty} />
      ) : (
        <Card>
          <ul className="divide-y divide-line/70">
            {broadcasts.map((b) => (
              <li key={b.id} className="px-5 py-4">
                <p className="font-semibold text-ink">{b.subject}</p>
                <p className="text-sm text-muted mt-1 leading-relaxed">{b.body}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted/70">
                  <span>{he.broadcastSentTo.replace('{n}', String(b.sentCount))}</span>
                  <span aria-hidden>·</span>
                  <span>{relativeHe(b.createdAt.getTime())}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
