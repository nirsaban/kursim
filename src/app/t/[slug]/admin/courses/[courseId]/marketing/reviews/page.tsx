import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import ReviewsSection from '@/components/admin/marketing/ReviewsSection';

export default async function MarketingReviewsPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  return <ReviewsSection courseId={courseId} />;
}
