import Link from 'next/link';
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
          className="ms-auto text-sm font-semibold text-brand-700 hover:underline"
        >
          {he.viewAllAchievements} ←
        </Link>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {achievements.map((a) => (
          <span
            key={a.id}
            title={a.unlocked ? he[a.descKey] : he.achievementLocked}
            className={
              a.unlocked
                ? 'inline-flex items-center gap-2 bg-card border border-line rounded-full ps-2 pe-3.5 py-1.5 text-sm font-semibold shadow-card'
                : 'inline-flex items-center gap-2 bg-card border border-line rounded-full ps-2 pe-3.5 py-1.5 text-sm font-medium opacity-40 grayscale'
            }
          >
            <span className="text-lg" aria-hidden>
              {a.icon}
            </span>
            {he[a.titleKey]}
          </span>
        ))}
      </div>
    </section>
  );
}
