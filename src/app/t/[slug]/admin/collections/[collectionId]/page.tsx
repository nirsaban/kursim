import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import PageHeader from '@/components/ui/PageHeader';
import CollectionEditor from '@/components/admin/CollectionEditor';
import { he } from '@/lib/he';

export default async function AdminCollectionEditPage({
  params,
}: {
  params: Promise<{ slug: string; collectionId: string }>;
}) {
  const { slug, collectionId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}/admin`);

  const courses = await forTenant(auth.tenantId!).course.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, priceAgorot: true, landingPublished: true },
  });

  return (
    <div>
      <PageHeader kicker={he.collectionsTitle} title={collectionId === 'new' ? he.collectionNew : he.collectionsTitle} />
      <CollectionEditor
        slug={slug}
        collectionId={collectionId === 'new' ? null : collectionId}
        courses={courses}
      />
    </div>
  );
}
