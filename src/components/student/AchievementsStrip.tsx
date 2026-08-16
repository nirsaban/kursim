import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import type { Achievement } from '@/lib/achievements';
import { he } from '@/lib/he';

/** Compact badge chips for the home page; full grid lives on the journey page. */
export default function AchievementsStrip({
  achievements,
  slug,
}: {
  achievements: Achievement[];
  slug: string;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="font-display text-xl font-bold">{he.achievementsTitle}</h2>
        <Link
          href={`/t/${slug}/journey`}
          className="ms-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
        >
          {he.viewAllAchievements}
          <Icon name="arrowForward" size={14} />
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {achievements.map((a) => (
          <span
            key={a.id}
            title={a.unlocked ? he[a.descKey] : he.achievementLocked}
            className={
              a.unlocked
                ? 'inline-flex items-center gap-2 bg-card border border-line rounded-full px-3.5 min-h-[40px] text-sm font-semibold text-ink shadow-card'
                : 'inline-flex items-center gap-2 bg-transparent border border-dashed border-line rounded-full px-3.5 min-h-[40px] text-sm font-medium text-muted/60'
            }
          >
            <Icon
              name={a.icon}
              size={15}
              className={a.unlocked ? 'text-copper-500' : 'text-muted/40'}
            />
            {he[a.titleKey]}
          </span>
        ))}
      </div>
    </section>
  );
}
