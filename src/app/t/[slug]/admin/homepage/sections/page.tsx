import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import SectionsSection from '@/components/admin/homepage/SectionsSection';

export default async function HomepageSectionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}`);

  return <SectionsSection />;
}
