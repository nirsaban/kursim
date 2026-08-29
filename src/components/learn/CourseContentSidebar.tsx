'use client';

import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import Icon from '@/components/ui/Icon';
import { he } from '@/lib/he';

export interface SidebarLesson {
  id: string;
  title: string;
  durationSec: number | null;
  hasVideo: boolean;
  completed: boolean;
  locked: boolean;
}

export interface SidebarSection {
  id: string;
  title: string;
  lessons: SidebarLesson[];
}

function minutes(sec: number | null | undefined) {
  return Math.max(1, Math.round((sec ?? 0) / 60));
}

/**
 * "Course content" accordion: one collapsible block per module, one row per
 * lecture with a completion checkbox, ordinal, title and duration.
 */
export default function CourseContentSidebar({
  slug,
  sections,
  currentId,
  completedIds,
  canMark,
  onMarkComplete,
  onClose,
}: {
  slug: string;
  sections: SidebarSection[];
  currentId: string;
  completedIds: Set<string>;
  canMark: boolean;
  onMarkComplete: (lessonId: string) => void;
  onClose?: () => void;
}) {
  const currentSection = sections.find((s) => s.lessons.some((l) => l.id === currentId))?.id;
  const [open, setOpen] = useState<Set<string>>(() => new Set(currentSection ? [currentSection] : []));

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  let ordinal = 0;

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2 px-4 h-14 border-b border-line">
        <h2 className="font-body font-bold text-base text-ink">{he.learnCourseContent}</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink text-lg leading-none px-1"
            aria-label={he.learnHideSidebar}
            title={he.learnHideSidebar}
          >
            ×
          </button>
        )}
      </div>

      {sections.map((section, si) => {
        const isOpen = open.has(section.id);
        const done = section.lessons.filter((l) => completedIds.has(l.id)).length;
        const totalSec = section.lessons.reduce((acc, l) => acc + (l.durationSec ?? 0), 0);
        const start = ordinal;
        ordinal += section.lessons.length;
        return (
          <div key={section.id} className="border-b border-line">
            <button
              type="button"
              onClick={() => toggle(section.id)}
              className="w-full flex items-start gap-3 text-start px-4 py-4 bg-brand-50 hover:bg-brand-100 transition-colors"
              aria-expanded={isOpen}
            >
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-ink leading-snug">
                  {he.learnSection.replace('{i}', String(si + 1)).replace('{title}', section.title)}
                </span>
                <span className="block text-xs text-muted mt-1 tabular-nums">
                  {he.learnSectionMeta
                    .replace('{done}', String(done))
                    .replace('{n}', String(section.lessons.length))
                    .replace('{min}', String(minutes(totalSec)))}
                </span>
              </span>
              <span
                className={cn('text-muted transition-transform duration-200 mt-0.5', isOpen && 'rotate-180')}
                aria-hidden
              >
                ▾
              </span>
            </button>

            {isOpen && (
              <ul>
                {section.lessons.map((lesson, li) => {
                  const n = start + li + 1;
                  const isCurrent = lesson.id === currentId;
                  const isDone = completedIds.has(lesson.id);
                  return (
                    <li
                      key={lesson.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 transition-colors',
                        isCurrent ? 'bg-brand-200/70' : 'hover:bg-brand-50',
                        lesson.locked && 'opacity-60',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 w-4 h-4 shrink-0 accent-ink cursor-pointer disabled:cursor-default"
                        checked={isDone}
                        disabled={!canMark || isDone || lesson.locked}
                        onChange={() => onMarkComplete(lesson.id)}
                        aria-label={isDone ? he.learnLectureDone : he.learnMarkComplete}
                        title={isDone ? he.learnLectureDone : he.learnMarkComplete}
                      />
                      {lesson.locked ? (
                        <span className="flex-1 min-w-0">
                          <span className="block text-ink leading-snug">
                            {n}. {lesson.title}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-muted mt-1">
                            <Icon name="lock" size={12} />
                            {he.lessonNavLocked}
                          </span>
                        </span>
                      ) : (
                        <Link
                          href={`/t/${slug}/lesson/${lesson.id}`}
                          className="flex-1 min-w-0"
                          aria-current={isCurrent ? 'page' : undefined}
                        >
                          <span className={cn('block leading-snug', isCurrent ? 'font-bold text-ink' : 'text-ink')}>
                            {n}. {lesson.title}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-muted mt-1 tabular-nums">
                            <Icon name={lesson.hasVideo ? 'video' : 'book'} size={12} />
                            {he.learnLectureMin.replace('{min}', String(minutes(lesson.durationSec)))}
                          </span>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
