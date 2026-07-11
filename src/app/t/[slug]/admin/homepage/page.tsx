import HomepageEditor from '@/components/admin/HomepageEditor';
import PageHeader from '@/components/ui/PageHeader';
import { he } from '@/lib/he';

export default async function AdminHomepagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="max-w-3xl">
      <PageHeader kicker={he.admin} title={he.homepageBuilder} subtitle={he.homepageBuilderSubtitle} />
      <HomepageEditor slug={slug} />
    </div>
  );
}
