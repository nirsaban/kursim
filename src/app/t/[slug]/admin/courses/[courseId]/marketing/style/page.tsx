import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import StyleSection from '@/components/admin/marketing/StyleSection';

export default async function MarketingStylePage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  return <StyleSection courseId={courseId} />;
}
