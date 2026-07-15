/**
 * The «קורסים.» logo mark — ק on a rounded tile with the vermilion Live dot.
 */
import { he } from '@/lib/he';

export default function LogoMark({
  size = 34,
  variant = 'ink',
}: {
  size?: number;
  variant?: 'ink' | 'bone' | 'vermilion';
}) {
  const fills = {
    ink: { tile: '#12151D', glyph: '#F5F2EB', dot: '#E4572E' },
    bone: { tile: '#F5F2EB', glyph: '#12151D', dot: '#E4572E' },
    vermilion: { tile: '#E4572E', glyph: '#FFFDF8', dot: '#12151D' },
  }[variant];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label={he.logoAria}>
      <rect x="2" y="2" width="60" height="60" rx="17" fill={fills.tile} />
      <text
        x="34"
        y="45"
        textAnchor="middle"
        fontFamily="var(--font-frank), serif"
        fontWeight="900"
        fontSize="38"
        fill={fills.glyph}
      >
        ק
      </text>
      <circle cx="49" cy="47" r="6.5" fill={fills.dot} />
    </svg>
  );
}
