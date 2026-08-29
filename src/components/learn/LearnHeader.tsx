import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { he } from '@/lib/he';

/** Dark course bar above the video stage: brand · course title · progress. */
export default function LearnHeader({
  slug,
  brandName,
  brandLogoUrl,
  courseTitle,
  done,
  total,
}: {
  slug: string;
  brandName: string;
  brandLogoUrl?: string;
  courseTitle: string;
  done: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const r = 14;
  const c = 2 * Math.PI * r;

  return (
    <header className="sticky top-0 z-40 h-14 bg-brand-900 text-white border-b border-brand-800">
      <div className="h-full flex items-center gap-3 sm:gap-4 px-3 sm:px-5">
        <Link
          href={`/t/${slug}`}
          className="flex items-center gap-2 shrink-0 min-w-0 max-w-[10rem] sm:max-w-[14rem] hover:opacity-90"
          title={he.learnBackHome}
        >
          {brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brandLogoUrl} alt="" className="h-7 w-auto max-w-[7rem] object-contain" />
          ) : (
            <span className="font-display font-bold text-base truncate">{brandName}</span>
          )}
        </Link>
        <span className="w-px h-6 bg-brand-700 shrink-0" aria-hidden />
        <p className="text-sm font-bold truncate min-w-0 flex-1">{courseTitle}</p>

        <div className="ms-auto flex items-center gap-3 sm:gap-5 shrink-0">
          <div
            className="flex items-center gap-2"
            title={he.learnProgressOf.replace('{done}', String(done)).replace('{n}', String(total))}
          >
            <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90 shrink-0" aria-hidden>
              <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r={r}
                fill="none"
                stroke="#8B4FE0"
                strokeWidth="3"
                strokeDasharray={c}
                strokeDashoffset={c - (c * pct) / 100}
                strokeLinecap="round"
              />
            </svg>
            <span className="hidden sm:block text-xs leading-tight">
              <span className="block font-bold">{he.learnYourProgress}</span>
              <span className="block text-brand-300 tabular-nums">
                {he.learnProgressOf.replace('{done}', String(done)).replace('{n}', String(total))}
              </span>
            </span>
          </div>
          <Link
            href={`/t/${slug}`}
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold border border-white/70 rounded-md px-3 py-1.5 hover:bg-white/10"
          >
            <Icon name="book" size={14} />
            {he.learnBackHome}
          </Link>
        </div>
      </div>
    </header>
  );
}
