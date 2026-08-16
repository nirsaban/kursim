import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import RemindersPanel from '@/components/admin/RemindersPanel';
import PageHeader from '@/components/ui/PageHeader';
import { he } from '@/lib/he';

export default async function AdminRemindersPage({
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
      <PageHeader kicker={he.admin} title={`${he.remindersTitle} ⏰`} subtitle={he.remindersSubtitle} />
      <RemindersPanel />
    </div>
  );
}
