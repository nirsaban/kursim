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
        ink ? 'bg-brand-950/95 border-brand-900 text-white' : 'bg-white/90 border-line',
      )}
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href={brandHref} className="flex items-center gap-2.5 min-w-0">
            <span
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0',
                ink ? 'bg-white/10' : 'bg-brand-100',
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
                  ink ? 'bg-white/15 text-white' : 'bg-brand-100 text-brand-800',
                )}
              >
                {roleLabel}
              </span>
            )}
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="ראשי">
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
        <nav className="md:hidden flex gap-1 overflow-x-auto pb-2 -mt-1" aria-label="ראשי">
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
        'text-sm font-medium rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors',
        active
          ? ink
            ? 'bg-white/15 text-white'
            : 'bg-brand-50 text-brand-800'
          : ink
            ? 'text-white/70 hover:text-white hover:bg-white/10'
            : 'text-muted hover:text-ink hover:bg-ink/5',
      )}
      aria-current={active ? 'page' : undefined}
    >
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
            ? 'bg-white/15 text-white hover:bg-white/25'
            : 'bg-brand-700 text-white hover:bg-brand-800',
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
          className="absolute end-0 mt-2 w-56 bg-white text-ink border border-line rounded-xl shadow-lift py-1.5 z-50"
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
