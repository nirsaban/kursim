import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import PromotionSection from '@/components/admin/marketing/PromotionSection';

export default async function MarketingPromotionPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  return <PromotionSection courseId={courseId} />;
}
