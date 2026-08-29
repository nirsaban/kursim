/**
 * Static strip of keywords/outcomes under the hero. Previously an
 * infinite-scroll marquee; flattened to a plain wrapped row per the
 * Udemy-style re-skin (no marquee/parallax excess).
 */
export default function Marquee({
  items,
  accent,
  className = '',
}: {
  items: string[];
  accent: string;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`overflow-hidden border-y border-line bg-paper py-3.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-4 px-4 text-sm font-bold whitespace-nowrap">
            {item}
            {i < items.length - 1 && (
              <span style={{ color: accent }} aria-hidden>
                ✦
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
