import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import NavTile from '@/components/ui/NavTile';
import { MARKETING_SECTIONS } from '@/lib/course-editor-sections';

export default async function MarketingHub({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
      {MARKETING_SECTIONS.map((s, i) => (
        <div key={s.key} className={`animate-rise rise-${i + 1}`}>
          <NavTile
            href={s.href(slug, courseId)}
            icon={s.icon}
            label={s.label}
            description={s.description}
          />
        </div>
      ))}
    </div>
  );
}
