/**
 * Drifting aurora — two blurred color blobs slowly wandering over a dark
 * surface. Pure CSS, animation disabled globally by prefers-reduced-motion.
 * Parent must be `relative overflow-hidden`.
 *
 * Unused by the flat Udemy-style redesign (decorative glows are out of
 * style) — kept for API compatibility with any future/other-scope call
 * site, recolored to the current palette.
 */
export default function Aurora({
  colors = ['rgba(109,40,210,0.30)', 'rgba(47,191,113,0.16)'],
}: {
  colors?: [string, string] | string[];
}) {
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      <div
        className="absolute -bottom-1/3 -start-1/4 w-[80%] h-[80%] rounded-full blur-3xl animate-drift"
        style={{ background: `radial-gradient(ellipse at center, ${colors[0]}, transparent 65%)` }}
      />
      <div
        className="absolute -top-1/3 -end-1/4 w-[70%] h-[70%] rounded-full blur-3xl animate-drift-slow"
        style={{ background: `radial-gradient(ellipse at center, ${colors[1]}, transparent 65%)` }}
      />
    </div>
  );
}
