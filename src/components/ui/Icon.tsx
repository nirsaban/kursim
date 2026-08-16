/**
 * The single icon language for the product: 24-grid stroke glyphs drawn with
 * currentColor, so icons inherit text color and never fight the palette.
 * Directional icons are authored for RTL (back points right, forward left).
 */

const STROKE_PATHS: Record<string, string[]> = {
  check: ['M5 12.5 10 17.5 19 7.5'],
  book: [
    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
    'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  ],
  bookmark: ['M6 3h12v18l-6-4.5L6 21z'],
  ticket: [
    'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z',
    'M13 5v2',
    'M13 11v2',
    'M13 17v2',
  ],
  award: ['M12 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z', 'M8.5 13.5 7 21l5-3 5 3-1.5-7.5'],
  flame: [
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  ],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  video: ['M3 6h13v12H3z', 'm22 8-6 4 6 4V8'],
  chart: ['M3 3v18h18', 'M8 17V9', 'M13 17V5', 'M18 17v-3'],
  trophy: [
    'M6 9H4.5a2.5 2.5 0 0 1 0-5H6',
    'M18 9h1.5a2.5 2.5 0 0 0 0-5H18',
    'M4 22h16',
    'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22',
    'M14 14.66V17c0 .55.47.98.97 1.21 1.18.54 2.03 2.03 2.03 3.79',
    'M18 2H6v7a6 6 0 0 0 12 0V2z',
  ],
  arrowBack: ['M5 12h14', 'm13 6 6 6-6 6'],
  arrowForward: ['M19 12H5', 'm11 18-6-6 6-6'],
  pin: ['M9 4h6l-1 6.5 3 3.5H7l3-3.5z', 'M12 14v7'],
  leaf: [
    'M11 20A7 7 0 0 1 9.8 6.1C13.5 5 17 4.5 19.5 2.5c.5 2 1.5 4.2 1.5 7.5 0 5.5-4.8 10-10 10z',
    'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12',
  ],
  bolt: ['M13 2 3 14h7l-1 8 10-12h-7l1-8z'],
  trendingUp: ['m22 7-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  mountain: ['m8 3 4 8 5-5 5 15H2L8 3z'],
  flag: ['M4 22V4c4-2 8 2 12 0v12c-4 2-8-2-12 0'],
  crown: ['M3 8l4.5 4L12 5l4.5 7L21 8l-1.5 11h-15z'],
  star: ['m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.2-5.6-3.1-5.6 3.1 1.2-6.2L3 9.6l6.3-.8z'],
  calendar: ['M3 6h18v15H3z', 'M16 3v4', 'M8 3v4', 'M3 10h18'],
  clock: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z', 'M12 7v5l3 2'],
  mail: ['M3 5h18v14H3z', 'm3 7 9 6 9-6'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 3.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.63a4 4 0 0 1 0 7.75',
  ],
};

/** Filled glyphs — shapes that read poorly as outlines at small sizes. */
const FILL_PATHS: Record<string, string[]> = {
  play: ['M8.5 5.5 18 12l-9.5 6.5z'],
  dot: ['M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z'],
  bookmarkFilled: ['M6 3h12v18l-6-4.5L6 21z'],
};

export type IconName = keyof typeof STROKE_PATHS | keyof typeof FILL_PATHS;

export default function Icon({
  name,
  size = 18,
  strokeWidth = 1.75,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const stroke = STROKE_PATHS[name];
  const fill = FILL_PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      {stroke?.map((d) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {fill?.map((d) => (
        <path key={d} d={d} fill="currentColor" />
      ))}
    </svg>
  );
}
