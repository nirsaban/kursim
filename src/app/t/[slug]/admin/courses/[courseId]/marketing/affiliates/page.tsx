import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import AffiliatesSection from '@/components/admin/marketing/AffiliatesSection';

export default async function MarketingAffiliatesPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  return <AffiliatesSection courseId={courseId} />;
}
