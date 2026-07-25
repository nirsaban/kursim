import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import PageHeader from '@/components/ui/PageHeader';
import NavTile from '@/components/ui/NavTile';
import { HOMEPAGE_SECTIONS } from '@/lib/homepage-sections';
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
    <div>
      <PageHeader kicker={he.admin} title={he.homepageBuilder} subtitle={he.homepageBuilderSubtitle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {HOMEPAGE_SECTIONS.map((s, i) => (
          <div key={s.key} className={`animate-rise rise-${i + 1}`}>
            <NavTile href={s.href(slug)} icon={s.icon} label={s.label} description={s.description} />
          </div>
        ))}
      </div>
    </div>
  );
}
