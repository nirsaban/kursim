'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import Icon from '@/components/ui/Icon';
import LessonPlayer, { PlayAttachment } from '@/components/LessonPlayer';
import LessonQA, { QAItem } from '@/components/LessonQA';
import LessonNotes from '@/components/LessonNotes';
import CourseContentSidebar, { SidebarSection } from '@/components/learn/CourseContentSidebar';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';

export interface LearnAnnouncement {
  title: string;
  body?: string;
  date?: string;
}

type Tab = 'content' | 'overview' | 'qa' | 'notes' | 'announcements';
const TABS: Tab[] = ['content', 'overview', 'qa', 'notes', 'announcements'];
const TAB_KEY = 'learn.tab';

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long' });

/**
 * The course-taking workspace: video stage with prev/next, a tab strip
 * (overview · Q&A · notes · announcements) and the "course content" sidebar
 * that lists every section and lecture. On narrow screens the sidebar folds
 * into a first tab.
 */
export default function LearnWorkspace({
  slug,
  lesson,
  index,
  total,
  prevHref,
  nextHref,
  initialPositionSec,
  isStudent,
  isStaff,
  sections,
  initialCompletedIds,
  questions,
  noteBody,
  announcements,
  completionExtras,
}: {
  slug: string;
  lesson: { id: string; title: string; notes: string | null; courseId: string };
  index: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
  initialPositionSec: number;
  isStudent: boolean;
  isStaff: boolean;
  sections: SidebarSection[];
  initialCompletedIds: string[];
  questions: QAItem[];
  noteBody: string;
  announcements: LearnAnnouncement[];
  /** Rendered in the overview once the course is complete (recap, rating, affiliate). */
  completionExtras?: React.ReactNode;
}) {
  const [tab, setTabState] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Moving between lectures is a full navigation; the chosen tab survives it
  // (read after mount so server and client render the same first frame).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(TAB_KEY) as Tab | null;
      if (saved && TABS.includes(saved) && (saved !== 'notes' || isStudent)) setTabState(saved);
    } catch {
      // storage unavailable — default tab
    }
  }, [isStudent]);
  function setTab(next: Tab) {
    setTabState(next);
    try {
      sessionStorage.setItem(TAB_KEY, next);
    } catch {
      // ignore
    }
  }
  const [attachments, setAttachments] = useState<PlayAttachment[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set(initialCompletedIds));

  function markComplete(lessonId: string) {
    setCompletedIds((prev) => new Set(prev).add(lessonId));
    apiFetch('/api/progress', {
      method: 'POST',
      body: JSON.stringify({ lessonId, completed: true }),
    }).catch(() => {});
  }

  const tabs: Array<{ id: Tab; label: string; mobileOnly?: boolean }> = [
    { id: 'content', label: he.learnTabCourseContent, mobileOnly: true },
    { id: 'overview', label: he.learnTabOverview },
    { id: 'qa', label: he.lessonQa },
    ...(isStudent ? [{ id: 'notes' as Tab, label: he.lessonNotesLabel }] : []),
    { id: 'announcements', label: he.learnTabAnnouncements },
  ];

  const sidebar = (
    <CourseContentSidebar
      slug={slug}
      sections={sections}
      currentId={lesson.id}
      completedIds={completedIds}
      canMark={isStudent}
      onMarkComplete={markComplete}
      onClose={() => setSidebarOpen(false)}
    />
  );

  return (
    <div className="flex items-start">
      <div className="flex-1 min-w-0">
        {/* Video stage */}
        <div className="bg-black">
          <div className="mx-auto max-w-[1280px]">
            <LessonPlayer
              lessonId={lesson.id}
              initialPositionSec={initialPositionSec}
              isStudent={isStudent}
              nextHref={nextHref}
              onData={setAttachments}
              onCompleted={() => setCompletedIds((prev) => new Set(prev).add(lesson.id))}
            />
          </div>
        </div>

        {/* Prev / position / next */}
        <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-line bg-paper">
          {prevHref ? (
            <Link
              href={prevHref}
              className="inline-flex items-center gap-1.5 text-sm font-bold border border-ink rounded-md px-3 py-2 hover:bg-brand-50"
            >
              <Icon name="arrowBack" size={14} />
              {he.lessonNavPrev}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-bold border border-line text-muted rounded-md px-3 py-2">
              <Icon name="arrowBack" size={14} />
              {he.lessonNavPrev}
            </span>
          )}
          <p className="flex-1 text-center text-xs sm:text-sm text-muted tabular-nums truncate">
            {he.learnLectureOf.replace('{i}', String(index + 1)).replace('{n}', String(total))}
          </p>
          {nextHref ? (
            <Link
              href={nextHref}
              className="inline-flex items-center gap-1.5 text-sm font-bold bg-copper-500 text-white rounded-md px-3 py-2 hover:bg-copper-600"
            >
              {he.lessonNavNext}
              <Icon name="arrowForward" size={14} />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-bold border border-line text-muted rounded-md px-3 py-2">
              {he.lessonNavNext}
              <Icon name="arrowForward" size={14} />
            </span>
          )}
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="hidden lg:inline-flex items-center gap-1.5 text-sm font-bold border border-ink rounded-md px-3 py-2 hover:bg-brand-50 ms-2"
            >
              <Icon name="book" size={14} />
              {he.learnShowSidebar}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-line px-4 sm:px-6 overflow-x-auto">
          <nav className="flex gap-6 min-w-max" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'py-3.5 text-sm font-bold border-b-2 -mb-px transition-colors whitespace-nowrap',
                  t.mobileOnly && 'lg:hidden',
                  tab === t.id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab panels */}
        <div className="px-4 sm:px-6 py-6 max-w-4xl">
          {tab === 'content' && <div className="lg:hidden border border-line rounded-lg overflow-hidden">{sidebar}</div>}

          {tab === 'overview' && (
            <div className="space-y-8">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold leading-snug">{lesson.title}</h1>
                <p className="kicker mt-4 mb-2">{he.learnAboutLesson}</p>
                {lesson.notes ? (
                  <div className="whitespace-pre-wrap text-ink leading-relaxed">{lesson.notes}</div>
                ) : (
                  <p className="text-muted">{he.learnNoDescription}</p>
                )}
              </div>

              {attachments.length > 0 && (
                <div>
                  <p className="kicker mb-3">{he.learnResources}</p>
                  <ul className="border border-line rounded-lg divide-y divide-line">
                    {attachments.map((a) => (
                      <li key={a.id}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-brand-50"
                        >
                          <span aria-hidden>📎</span>
                          <span className="truncate">{a.filename}</span>
                          <span className="ms-auto text-xs font-bold text-copper-700">{he.download}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {completionExtras}
            </div>
          )}

          {tab === 'qa' && (
            <LessonQA lessonId={lesson.id} isStudent={isStudent} isStaff={isStaff} initialQuestions={questions} />
          )}

          {tab === 'notes' && isStudent && (
            <LessonNotes lessonId={lesson.id} courseId={lesson.courseId} initialBody={noteBody} />
          )}

          {tab === 'announcements' &&
            (announcements.length === 0 ? (
              <p className="text-muted">{he.learnNoAnnouncements}</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {announcements.map((a, i) => (
                  <li key={i} className="py-5">
                    <div className="flex items-baseline gap-3">
                      <p className="font-bold text-ink">{a.title}</p>
                      {a.date && (
                        <span className="ms-auto shrink-0 text-xs text-muted tabular-nums">
                          {dateFmt.format(new Date(`${a.date}T00:00:00`))}
                        </span>
                      )}
                    </div>
                    {a.body && (
                      <p className="text-sm text-ink mt-1.5 leading-relaxed whitespace-pre-line">{a.body}</p>
                    )}
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </div>

      {/* Course content sidebar (desktop) */}
      {sidebarOpen && (
        <aside className="hidden lg:block w-[25rem] shrink-0 border-s border-line bg-paper sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          {sidebar}
        </aside>
      )}
    </div>
  );
}
