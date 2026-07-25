import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import AnnouncementsSection from '@/components/admin/homepage/AnnouncementsSection';

export default async function HomepageAnnouncementsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}`);

  return <AnnouncementsSection />;
}
