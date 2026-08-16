import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import ApiKeysPanel from '@/components/admin/ApiKeysPanel';
import PageHeader from '@/components/ui/PageHeader';
import { he } from '@/lib/he';

export default async function AdminApiPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}`);

  return (
    <div>
      <PageHeader kicker={he.admin} title={`${he.apiPageTitle} 🔌`} subtitle={he.apiPageSubtitle} />
      <ApiKeysPanel />
    </div>
  );
}
