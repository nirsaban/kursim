import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import HomepageEditor from '@/components/admin/HomepageEditor';
import PageHeader from '@/components/ui/PageHeader';
import { he } from '@/lib/he';

export default async function AdminHomepagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}`);

  return (
    <div className="max-w-3xl">
      <PageHeader kicker={he.admin} title={he.homepageBuilder} subtitle={he.homepageBuilderSubtitle} />
      <HomepageEditor slug={slug} />
    </div>
  );
}
