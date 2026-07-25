import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import CopySection from '@/components/admin/marketing/CopySection';

export default async function MarketingCopyPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  return <CopySection courseId={courseId} tenantSlug={slug} />;
}
