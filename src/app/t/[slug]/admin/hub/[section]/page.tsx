import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import PageHeader from '@/components/ui/PageHeader';
import NavTile from '@/components/ui/NavTile';
import { findAdminSection } from '@/lib/admin-sections';
import { he } from '@/lib/he';

export default async function AdminSectionHub({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const { slug, section } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}/admin`);

  const config = findAdminSection(section);
  if (!config) notFound();

  return (
    <div>
      <PageHeader kicker={he.admin} title={config.label} subtitle={config.description} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {config.items.map((item, i) => (
          <div key={item.key} className={`animate-rise rise-${i + 1}`}>
            <NavTile
              href={item.href(slug)}
              icon={item.icon}
              label={item.label}
              description={item.description}
              liveDot={item.liveDot}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
