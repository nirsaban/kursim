import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import PageHeader from '@/components/ui/PageHeader';
import CommunityBoard from '@/components/community/CommunityBoard';
import { he } from '@/lib/he';

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const isStaff = auth.role === 'OWNER' || auth.role === 'INSTRUCTOR';
  const db = forTenant(auth.tenantId!);
  const posts = await db.communityPost.findMany({
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });

  return (
    <div>
      <PageHeader title={he.community} subtitle={he.communitySubtitle} />
      <CommunityBoard
        slug={slug}
        initialPosts={JSON.parse(JSON.stringify(posts))}
        isStaff={isStaff}
      />
    </div>
  );
}
