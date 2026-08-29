import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { he } from '@/lib/he';

export default async function AdminCollectionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}/admin`);

  const db = forTenant(auth.tenantId!);
  const [collections, courseCount] = await Promise.all([
    db.courseCollection.findMany({ orderBy: { createdAt: 'desc' } }),
    db.course.count(),
  ]);

  const newBtn =
    courseCount >= 2 ? (
      <Link
        href={`/t/${slug}/admin/collections/new`}
        className="inline-flex items-center bg-copper-500 hover:bg-copper-600 text-white text-sm font-semibold rounded-xl px-4 py-2 transition-colors"
      >
        + {he.collectionNew}
      </Link>
    ) : null;

  return (
    <div>
      <PageHeader kicker={he.admin} title={he.collectionsTitle} subtitle={he.collectionsSubtitle} actions={newBtn} />
      {collections.length === 0 ? (
        <EmptyState
          icon="🧩"
          title={he.collectionNone}
          hint={courseCount < 2 ? he.collectionNoneHint : undefined}
          action={newBtn ?? undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/t/${slug}/admin/collections/${c.id}`}
              className="group bg-card border border-line rounded-xl2 shadow-card hover:shadow-lift transition-shadow p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-lg truncate">{c.title}</h3>
                {c.published ? (
                  <Badge tone="ok" dot>
                    {he.collectionPublished}
                  </Badge>
                ) : (
                  <Badge tone="neutral">{he.landingDraftBadge}</Badge>
                )}
              </div>
              <p className="text-sm text-muted mt-1">
                {he.collectionCoursesCount.replace('{n}', String(c.courseIds.length))} · {he.collectionViews}: {c.views}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
