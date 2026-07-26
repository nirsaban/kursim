'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { he } from '@/lib/he';

export interface LessonNavItem {
  id: string;
  title: string;
  moduleId: string;
  moduleTitle: string;
  /** The student already finished it (staff always get false). */
  completed?: boolean;
  /** Still behind a drip release — listed, but not clickable. */
  locked?: boolean;
}

/**
 * The lesson player's navigation strip: previous / next plus a dropdown that
 * jumps to any lesson in the course, grouped by module.
 */
export default function LessonNav({
  slug,
  lessons,
  currentId,
}: {
  slug: string;
  lessons: LessonNavItem[];
  currentId: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLAnchorElement | null>(null);

  const idx = lessons.findIndex((l) => l.id === currentId);
  const prev = idx > 0 ? lessons[idx - 1] : null;
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    currentRef.current?.scrollIntoView({ block: 'center' });
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const position = he.lessonPositionOf
    .replace('{i}', String(idx + 1))
    .replace('{n}', String(lessons.length));

  const sideBtn =
    'shrink-0 inline-flex items-center gap-1.5 text-sm font-medium bg-card border border-line rounded-xl px-3 py-2.5 hover:border-brand-300 transition-colors disabled:opacity-40';

  let lastModule = '';

  return (
    <div className="mt-4 flex items-center gap-2">
      {prev ? (
        <Link href={`/t/${slug}/lesson/${prev.id}`} className={sideBtn} title={prev.title}>
          <span aria-hidden>→</span>
          <span className="hidden sm:inline max-w-[9rem] truncate">{prev.title}</span>
          <span className="sm:hidden">{he.lessonNavPrev}</span>
        </Link>
      ) : (
        <span className={cn(sideBtn, 'opacity-40 pointer-events-none')} aria-hidden>
          <span>→</span>
          <span className="hidden sm:inline">{he.lessonNavPrev}</span>
        </span>
      )}

      <div className="relative flex-1 min-w-0" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full inline-flex items-center justify-between gap-2 text-sm font-semibold bg-card border border-line rounded-xl px-4 py-2.5 hover:border-brand-300 transition-colors"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="min-w-0 truncate">
            <span className="text-muted font-medium">{position}</span>
            <span className="mx-2 text-line" aria-hidden>
              |
            </span>
            {he.jumpToLesson}
          </span>
          <span className={cn('transition-transform text-muted', open && 'rotate-180')} aria-hidden>
            ▾
          </span>
        </button>

        {open && (
          <div
            className="absolute z-30 top-full mt-2 inset-x-0 bg-card border border-line rounded-xl2 shadow-card overflow-hidden"
            role="menu"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-line bg-paper">
              <p className="kicker">{he.allCourseLessons}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-muted hover:text-ink"
              >
                {he.closeMenu}
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {lessons.map((l, i) => {
                const isCurrent = l.id === currentId;
                const newModule = l.moduleId !== lastModule;
                lastModule = l.moduleId;
                const row = (
                  <>
                    <span className="w-6 shrink-0 text-xs text-muted tabular-nums">{i + 1}.</span>
                    <span className="flex-1 min-w-0 truncate">{l.title}</span>
                    {l.locked ? (
                      <span title={he.lessonNavLocked} aria-label={he.lessonNavLocked}>
                        🔒
                      </span>
                    ) : l.completed ? (
                      <span className="text-ok" title={he.lessonNavDone} aria-label={he.lessonNavDone}>
                        ✓
                      </span>
                    ) : null}
                  </>
                );
                return (
                  <div key={l.id}>
                    {newModule && (
                      <p className="kicker px-4 pt-3 pb-1 text-muted">{l.moduleTitle}</p>
                    )}
                    {l.locked ? (
                      <span className="flex items-center gap-2 px-4 py-2 text-sm text-muted opacity-60">
                        {row}
                      </span>
                    ) : (
                      <Link
                        ref={isCurrent ? currentRef : undefined}
                        href={`/t/${slug}/lesson/${l.id}`}
                        onClick={() => setOpen(false)}
                        role="menuitem"
                        aria-current={isCurrent ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 text-sm transition-colors',
                          isCurrent
                            ? 'bg-copper-50 text-copper-800 font-semibold'
                            : 'hover:bg-ink/5',
                        )}
                      >
                        {row}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {next ? (
        <Link
          href={`/t/${slug}/lesson/${next.id}`}
          className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold bg-brand-700 text-white rounded-xl px-3 py-2.5 hover:bg-brand-800 transition-colors"
          title={next.title}
        >
          <span className="hidden sm:inline max-w-[9rem] truncate">{next.title}</span>
          <span className="sm:hidden">{he.lessonNavNext}</span>
          <span aria-hidden>←</span>
        </Link>
      ) : (
        <span className={cn(sideBtn, 'opacity-40 pointer-events-none')} aria-hidden>
          <span className="hidden sm:inline">{he.lessonNavNext}</span>
          <span>←</span>
        </span>
      )}
    </div>
  );
}
