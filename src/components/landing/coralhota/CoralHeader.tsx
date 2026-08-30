'use client';

import { useEffect, useState } from 'react';

const CREAM = '#EEEBE3';

type NavLink = { href: string; label: string };

/**
 * Sticky header that starts blended into the dark hero (transparent, white
 * text) and solidifies to a cream bar with a border once the visitor scrolls
 * past it — mirrors the reference site's header behavior.
 */
export default function CoralHeader({
  tenantName,
  tenantBrandColor,
  navLinks,
  ctaHref,
  ctaText,
  externalProps,
}: {
  tenantName: string;
  tenantBrandColor: string;
  navLinks: NavLink[];
  ctaHref: string;
  ctaText: string;
  externalProps: { target?: '_blank'; rel?: 'noopener noreferrer' };
}) {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 72);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        solid ? 'border-b border-black/10 backdrop-blur shadow-sm' : 'border-b border-transparent'
      }`}
      style={{ background: solid ? `${CREAM}F2` : 'transparent' }}
    >
      <div className="max-w-6xl mx-auto px-4 h-[68px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-9 h-9 rounded-full text-white grid place-items-center font-bold text-lg shrink-0"
            style={{ background: tenantBrandColor }}
            aria-hidden
          >
            {tenantName.charAt(0)}
          </span>
          <span
            className="font-extrabold truncate transition-colors duration-300"
            style={{ color: solid ? tenantBrandColor : '#ffffff' }}
          >
            {tenantName}
          </span>
        </div>
        <nav
          className={`hidden sm:flex items-center gap-5 text-sm font-semibold transition-colors duration-300 ${
            solid ? 'text-[#160303]/70' : 'text-white/80'
          }`}
        >
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className={solid ? 'hover:text-[#160303]' : 'hover:text-white'}>
              {l.label}
            </a>
          ))}
        </nav>
        <a
          href={ctaHref}
          {...externalProps}
          className="shrink-0 inline-flex items-center justify-center text-sm font-bold rounded-full bg-black text-white px-6 py-3 transition-transform hover:scale-[1.04]"
        >
          {ctaText}
        </a>
      </div>
    </header>
  );
}
