import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import SettingsForm from '@/components/admin/SettingsForm';
import PageHeader from '@/components/ui/PageHeader';
import { he } from '@/lib/he';

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}`);

  return (
    <div className="max-w-xl">
      <PageHeader kicker={he.admin} title={he.settings} />
      <SettingsForm />
    </div>
  );
}
