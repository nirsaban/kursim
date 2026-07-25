import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import GallerySection from '@/components/admin/marketing/GallerySection';

export default async function MarketingGalleryPage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  return <GallerySection courseId={courseId} />;
}
