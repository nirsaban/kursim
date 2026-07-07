type Kind = 'phone' | 'tablet' | 'tv' | 'laptop';

function kindOf(label: string): Kind {
  const l = label.toLowerCase();
  if (/(iphone|android(?!.*tablet)|mobile|pixel|galaxy(?! tab))/.test(l)) return 'phone';
  if (/(ipad|tablet|tab )/.test(l)) return 'tablet';
  if (/(tv|chromecast|apple tv)/.test(l)) return 'tv';
  return 'laptop';
}

/** Outline device glyph inferred from the session's device label. */
export default function DeviceIcon({
  label,
  size = 26,
  className,
}: {
  label: string;
  size?: number;
  className?: string;
}) {
  const kind = kindOf(label);
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    className,
    'aria-hidden': true,
  } as const;
  switch (kind) {
    case 'phone':
      return (
        <svg {...common}>
          <rect x="7" y="2.5" width="10" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="18.4" r="1" fill="currentColor" />
        </svg>
      );
    case 'tablet':
      return (
        <svg {...common}>
          <rect x="4.5" y="3" width="15" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="18" r="1" fill="currentColor" />
        </svg>
      );
    case 'tv':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="12" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 20h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="11" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
          <path d="M2.5 18.5h19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
}
