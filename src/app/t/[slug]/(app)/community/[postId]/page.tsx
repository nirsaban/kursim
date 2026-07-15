import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import PostThread from '@/components/community/PostThread';

export default async function CommunityPostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const db = forTenant(auth.tenantId!);
  const post = await db.communityPost.findFirst({ where: { id: postId } });
  if (!post) notFound();

  const replies = await db.communityReply.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
  });

  const isStaff = auth.role === 'OWNER' || auth.role === 'INSTRUCTOR';

  return (
    <PostThread
      slug={slug}
      post={JSON.parse(JSON.stringify(post))}
      initialReplies={JSON.parse(JSON.stringify(replies))}
      isStaff={isStaff}
      currentUserId={auth.userId}
    />
  );
}
