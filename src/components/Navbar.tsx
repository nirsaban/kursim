'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { he } from '@/lib/he';
import { loginPathFor } from '@/lib/client/api';

export interface NavLink {
  href: string;
  label: string;
  exact?: boolean;
  /** Renders the pulsing Live dot next to the label (the seats motif). */
  liveDot?: boolean;
}

export default function Navbar({
  brandName,
  brandHref,
  brandEmoji = '🎓',
  links,
  userEmail,
  roleLabel,
  changePasswordHref,
  tone = 'light',
}: {
  brandName: string;
  brandHref: string;
  brandEmoji?: string;
  links: NavLink[];
  userEmail?: string;
  roleLabel?: string;
  changePasswordHref?: string;
  tone?: 'light' | 'ink';
}) {
  const pathname = usePathname();
  const ink = tone === 'ink';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b backdrop-blur',
        ink ? 'bg-ink/95 border-ink-surface text-paper' : 'bg-card/90 border-line',
      )}
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href={brandHref} className="flex items-center gap-2.5 min-w-0">
            <span
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0',
                ink ? 'bg-paper/10' : 'bg-paper border border-line',
              )}
              aria-hidden
            >
              {brandEmoji}
            </span>
            <span className="font-display font-bold truncate">{brandName}</span>
            {roleLabel && (
              <span
                className={cn(
                  'text-[11px] font-semibold rounded-full px-2 py-0.5 shrink-0',
                  ink ? 'bg-paper/15 text-paper' : 'bg-ink text-paper',
                )}
              >
                {roleLabel}
              </span>
            )}
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label={he.navMain}>
            {links.map((l) => (
              <NavItem key={l.href} link={l} pathname={pathname} ink={ink} />
            ))}
          </nav>

          {userEmail && (
            <UserMenu
              email={userEmail}
              changePasswordHref={changePasswordHref}
              ink={ink}
            />
          )}
        </div>

        {/* Mobile nav row */}
        <nav className="md:hidden flex gap-1 overflow-x-auto pb-2 -mt-1" aria-label={he.navMain}>
          {links.map((l) => (
            <NavItem key={l.href} link={l} pathname={pathname} ink={ink} />
          ))}
        </nav>
      </div>
    </header>
  );
}

function NavItem({
  link,
  pathname,
  ink,
}: {
  link: NavLink;
  pathname: string;
  ink: boolean;
}) {
  const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
  return (
    <Link
      href={link.href}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors',
        active
          ? ink
            ? 'bg-paper/10 text-paper font-semibold'
            : 'bg-ink/5 text-ink font-semibold'
          : ink
            ? 'text-brand-300 hover:text-paper hover:bg-paper/5'
            : 'text-muted hover:text-ink hover:bg-ink/5',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {link.liveDot && (
        <span className="w-[7px] h-[7px] rounded-full bg-live animate-pulse-live" />
      )}
      {link.label}
    </Link>
  );
}

function UserMenu({
  email,
  changePasswordHref,
  ink,
}: {
  email: string;
  changePasswordHref?: string;
  ink: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = loginPathFor(window.location.pathname);
  }

  const initial = email[0]?.toUpperCase() ?? '?';

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-9 h-9 rounded-full font-display font-bold text-sm flex items-center justify-center transition-colors',
          ink
            ? 'bg-copper-500 text-card hover:bg-copper-600'
            : 'bg-ink text-card hover:bg-ink-surface',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        title={email}
      >
        <span dir="ltr">{initial}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 mt-2 w-56 bg-card text-ink border border-line rounded-xl shadow-lift py-1.5 z-50"
        >
          <p className="px-4 py-2 text-xs text-muted border-b border-line truncate" dir="ltr">
            {email}
          </p>
          {changePasswordHref && (
            <Link
              href={changePasswordHref}
              className="block px-4 py-2 text-sm hover:bg-paper"
              onClick={() => setOpen(false)}
            >
              {he.changePassword}
            </Link>
          )}
          <button
            onClick={logout}
            className="block w-full text-start px-4 py-2 text-sm text-danger hover:bg-paper"
          >
            {he.logout}
          </button>
        </div>
      )}
    </div>
  );
}
