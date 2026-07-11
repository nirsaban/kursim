/**
 * Infinite scrolling strip of keywords/outcomes — the "exclusive brand" band
 * under the hero. Pure CSS animation (animate-marquee translates the doubled
 * track by exactly one copy, so the loop is seamless); reduced-motion users
 * get a static strip via the global media query.
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
  const copy = (key: string, hidden = false) => (
    <div key={key} className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <span
          key={i}
          className="flex items-center gap-4 px-4 text-sm font-bold whitespace-nowrap"
        >
          {item}
          <span style={{ color: accent }} aria-hidden>
            ✦
          </span>
        </span>
      ))}
    </div>
  );
  return (
    <div className={`overflow-hidden border-y border-line bg-paper py-3.5 ${className}`}>
      <div className="flex w-max animate-marquee will-change-transform">
        {copy('a')}
        {copy('b', true)}
      </div>
    </div>
  );
}
