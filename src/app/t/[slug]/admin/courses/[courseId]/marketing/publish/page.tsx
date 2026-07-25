import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import PublishSection from '@/components/admin/marketing/PublishSection';

export default async function MarketingPublishPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  return <PublishSection courseId={courseId} tenantSlug={slug} />;
}
