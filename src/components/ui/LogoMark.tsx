/**
 * The GeniriSchool mark — a copper G on a rounded tile, with the vermilion
 * Live dot the rest of the UI uses for "a seat is in use".
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
    ink: { tile: '#12151D', glyph: '#E4572E', dot: '#F5F2EB' },
    bone: { tile: '#F5F2EB', glyph: '#12151D', dot: '#E4572E' },
    vermilion: { tile: '#E4572E', glyph: '#FFFDF8', dot: '#12151D' },
  }[variant];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label={he.logoAria}>
      <rect x="2" y="2" width="60" height="60" rx="17" fill={fills.tile} />
      <g fill="none" stroke={fills.glyph} strokeWidth="5.5" strokeLinecap="round">
        <path d="M 39.46 21.35 A 13 13 0 1 0 45 32" />
        <path d="M 32 32 L 45 32" />
      </g>
      <circle cx="51.5" cy="51.5" r="5" fill={fills.dot} />
    </svg>
  );
}
