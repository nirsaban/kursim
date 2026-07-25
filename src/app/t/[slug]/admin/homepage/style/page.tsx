import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import StyleSection from '@/components/admin/homepage/StyleSection';

export default async function HomepageStylePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}`);

  return <StyleSection />;
}
