import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import LinksStudio from '@/components/admin/LinksStudio';
import PageHeader from '@/components/ui/PageHeader';
import { he } from '@/lib/he';

export default async function AdminLinksPage({
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
      <PageHeader kicker={he.admin} title={`${he.linksTitle} 🔗`} subtitle={he.linksSubtitle} />
      <LinksStudio slug={slug} />
    </div>
  );
}
