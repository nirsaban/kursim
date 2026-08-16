'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { he } from '@/lib/he';
import { loginPathFor } from '@/lib/client/api';
import NotificationBell from '@/components/NotificationBell';
import Monogram from '@/components/ui/Monogram';

export interface NavLink {
  href: string;
  label: string;
  exact?: boolean;
  /** Renders the pulsing Live dot next to the label (the seats motif). */
  liveDot?: boolean;
}

/** A labelled dropdown of related links, to keep the bar uncluttered. */
export interface NavGroup {
  label: string;
  items: NavLink[];
  liveDot?: boolean;
}

export type NavEntry = NavLink | NavGroup;

function isGroup(e: NavEntry): e is NavGroup {
  return (e as NavGroup).items !== undefined;
}

export default function Navbar({
  brandName,
  brandHref,
  brandEmoji,
  brandLogoUrl,
  brandLogoSize = 36,
  links,
  userEmail,
  roleLabel,
  changePasswordHref,
  tone = 'light',
  notifSlug,
}: {
  brandName: string;
  brandHref: string;
  brandEmoji?: string;
  /** Tenant logo (branding studio); replaces the emoji tile when set. */
  brandLogoUrl?: string;
  brandLogoSize?: number;
  links: NavEntry[];
  userEmail?: string;
  roleLabel?: string;
  changePasswordHref?: string;
  tone?: 'light' | 'ink';
  /** When set, renders the notification bell (student-facing routes). */
  notifSlug?: string;
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
            {brandLogoUrl || brandEmoji ? (
              <span
                className={cn(
                  'rounded-xl flex items-center justify-center text-lg shrink-0 overflow-hidden',
                  ink ? 'bg-paper/10' : 'bg-paper border border-line',
                )}
                style={{ width: brandLogoSize, height: brandLogoSize }}
                aria-hidden
              >
                {brandLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brandLogoUrl} alt="" className="max-w-full max-h-full object-contain" />
                ) : (
                  brandEmoji
                )}
              </span>
            ) : (
              <Monogram
                name={brandName}
                size="sm"
                className={ink ? '!bg-paper/10 !border-transparent text-paper' : undefined}
              />
            )}
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
            {links.map((e, i) =>
              isGroup(e) ? (
                <NavGroupItem key={`g${i}`} group={e} pathname={pathname} ink={ink} />
              ) : (
                <NavItem key={e.href} link={e} pathname={pathname} ink={ink} />
              ),
            )}
          </nav>

          <div className="flex items-center gap-1.5 shrink-0">
            {notifSlug && <NotificationBell slug={notifSlug} />}
            {userEmail && (
              <UserMenu
                email={userEmail}
                changePasswordHref={changePasswordHref}
                ink={ink}
              />
            )}
          </div>
        </div>

        {/* Mobile nav row — groups flatten into their links */}
        {/* [&>a]:py-3 lifts the links to a ~44px touch target on phones. */}
        <nav
          className="md:hidden flex gap-1 overflow-x-auto pb-2 -mt-1 [&>a]:py-3"
          aria-label={he.navMain}
        >
          {links.flatMap((e) => (isGroup(e) ? e.items : [e])).map((l) => (
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

function NavGroupItem({
  group,
  pathname,
  ink,
}: {
  group: NavGroup;
  pathname: string;
  ink: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuEntered, setMenuEntered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setMenuMounted(true);
      const id = requestAnimationFrame(() => setMenuEntered(true));
      return () => cancelAnimationFrame(id);
    }
    setMenuEntered(false);
    const timer = setTimeout(() => setMenuMounted(false), 200);
    return () => clearTimeout(timer);
  }, [open]);

  const isActive = (l: NavLink) => (l.exact ? pathname === l.href : pathname.startsWith(l.href));
  const active = group.items.some(isActive);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
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
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {group.liveDot && <span className="w-[7px] h-[7px] rounded-full bg-live animate-pulse-live" />}
        {group.label}
        <span aria-hidden className="text-[10px] opacity-70">▾</span>
      </button>
      {menuMounted && (
        <div
          role="menu"
          className={cn(
            'absolute end-0 mt-2 w-52 bg-card text-ink border border-line rounded-xl shadow-lift py-1.5 z-50 origin-top transition-[opacity,transform] duration-200 ease-out',
            menuEntered ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
          )}
        >
          {group.items.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm hover:bg-paper',
                isActive(l) && 'font-semibold text-ink',
              )}
            >
              {l.liveDot && <span className="w-[7px] h-[7px] rounded-full bg-live animate-pulse-live" />}
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
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
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuEntered, setMenuEntered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setMenuMounted(true);
      const id = requestAnimationFrame(() => setMenuEntered(true));
      return () => cancelAnimationFrame(id);
    }
    setMenuEntered(false);
    const timer = setTimeout(() => setMenuMounted(false), 200);
    return () => clearTimeout(timer);
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
          'w-10 h-10 rounded-full font-display font-bold text-sm flex items-center justify-center transition-colors',
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
      {menuMounted && (
        <div
          role="menu"
          className={cn(
            'absolute end-0 mt-2 w-56 bg-card text-ink border border-line rounded-xl shadow-lift py-1.5 z-50 origin-top transition-[opacity,transform] duration-200 ease-out',
            menuEntered ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
          )}
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
