'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { cn } from '@/lib/cn';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import EmptyState from '@/components/ui/EmptyState';
import MediaUploader from './MediaUploader';

interface Attachment {
  id: string;
  filename: string;
  kind: string;
}
interface Lesson {
  id: string;
  title: string;
  notes: string | null;
  videoPublicId: string | null;
  durationSec: number | null;
  attachments: Attachment[];
}
interface Module {
  id: string;
  title: string;
  dripDays?: number;
  lessons: Lesson[];
}
export interface CourseStructure {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  modules: Module[];
}

/** Small transient "✓ saved" flash next to whatever field just autosaved. */
function SavedFlash({ shown }: { shown: boolean }) {
  return (
    <span
      className={cn(
        'text-xs font-medium text-ok transition-opacity duration-300',
        shown ? 'opacity-100' : 'opacity-0',
      )}
      aria-hidden={!shown}
    >
      {he.saved}
    </span>
  );
}

export default function ContentTab({
  course,
  courseId,
  reload,
}: {
  course: CourseStructure;
  courseId: string;
  reload: () => void;
}) {
  const [newModule, setNewModule] = useState('');
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [dripOpenIds, setDripOpenIds] = useState<Set<string>>(
    () => new Set(course.modules.filter((m) => (m.dripDays ?? 0) > 0).map((m) => m.id)),
  );
  const [bulkOpenIds, setBulkOpenIds] = useState<Set<string>>(new Set());

  function flash(key: string) {
    setSavedKey(key);
    setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1500);
  }

  async function addModule(e: React.FormEvent) {
    e.preventDefault();
    if (!newModule.trim()) return;
    await apiFetch(`/api/courses/${courseId}/modules`, {
      method: 'POST',
      body: JSON.stringify({ title: newModule.trim() }),
    });
    setNewModule('');
    reload();
  }

  async function deleteModule(id: string) {
    if (!confirm(he.confirmDelete)) return;
    await apiFetch(`/api/modules/${id}`, { method: 'DELETE' });
    reload();
  }

  async function renameModule(id: string, title: string) {
    await apiFetch(`/api/modules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
    flash(`module-title-${id}`);
    reload();
  }

  async function setDripDays(id: string, dripDays: number) {
    await apiFetch(`/api/modules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ dripDays }),
    });
    flash(`module-drip-${id}`);
    reload();
  }

  async function moveModule(index: number, dir: -1 | 1) {
    const swapIndex = index + dir;
    if (swapIndex < 0 || swapIndex >= course.modules.length) return;
    const a = course.modules[index];
    const b = course.modules[swapIndex];
    await Promise.all([
      apiFetch(`/api/modules/${a.id}`, { method: 'PATCH', body: JSON.stringify({ sortOrder: swapIndex }) }),
      apiFetch(`/api/modules/${b.id}`, { method: 'PATCH', body: JSON.stringify({ sortOrder: index }) }),
    ]);
    reload();
  }

  async function addLesson(moduleId: string, title: string) {
    await apiFetch(`/api/modules/${moduleId}/lessons`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    reload();
  }

  async function addLessonsBulk(moduleId: string, titles: string[]) {
    for (const title of titles) {
      await apiFetch(`/api/modules/${moduleId}/lessons`, {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
    }
    reload();
  }

  async function patchLesson(id: string, data: Record<string, unknown>, flashKey: string) {
    await apiFetch(`/api/lessons/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    flash(flashKey);
    reload();
  }

  async function deleteLesson(id: string) {
    if (!confirm(he.confirmDelete)) return;
    await apiFetch(`/api/lessons/${id}`, { method: 'DELETE' });
    reload();
  }

  async function moveLesson(mod: Module, index: number, dir: -1 | 1) {
    const swapIndex = index + dir;
    if (swapIndex < 0 || swapIndex >= mod.lessons.length) return;
    const a = mod.lessons[index];
    const b = mod.lessons[swapIndex];
    await Promise.all([
      apiFetch(`/api/lessons/${a.id}`, { method: 'PATCH', body: JSON.stringify({ sortOrder: swapIndex }) }),
      apiFetch(`/api/lessons/${b.id}`, { method: 'PATCH', body: JSON.stringify({ sortOrder: index }) }),
    ]);
    reload();
  }

  function toggleDrip(id: string) {
    setDripOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleBulk(id: string) {
    setBulkOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {course.modules.length === 0 && (
        <EmptyState icon="📦" title={he.noModules} hint={he.modulesEmptyHint} />
      )}

      {course.modules.map((mod, mi) => (
        <section key={mod.id} className="bg-card border border-line rounded-xl2 shadow-card">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-line bg-paper/50 rounded-t-xl2">
            <div className="flex flex-col shrink-0" aria-hidden>
              <button
                type="button"
                onClick={() => moveModule(mi, -1)}
                disabled={mi === 0}
                aria-label={he.moveUp}
                className="text-muted hover:text-ink disabled:opacity-25 disabled:hover:text-muted leading-none px-0.5"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveModule(mi, 1)}
                disabled={mi === course.modules.length - 1}
                aria-label={he.moveDown}
                className="text-muted hover:text-ink disabled:opacity-25 disabled:hover:text-muted leading-none px-0.5"
              >
                ▼
              </button>
            </div>
            <span className="kicker shrink-0">
              {he.moduleOrdinal} {mi + 1}
            </span>
            <input
              className="font-display font-bold bg-transparent outline-none flex-1 border-b border-transparent focus:border-brand-300"
              defaultValue={mod.title}
              aria-label={he.moduleTitle}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== mod.title) {
                  renameModule(mod.id, e.target.value.trim());
                }
              }}
            />
            <SavedFlash shown={savedKey === `module-title-${mod.id}`} />
            <button
              type="button"
              onClick={() => toggleDrip(mod.id)}
              className={cn(
                'text-xs font-medium shrink-0 transition-colors',
                dripOpenIds.has(mod.id) || (mod.dripDays ?? 0) > 0
                  ? 'text-brand-700'
                  : 'text-muted hover:text-ink',
              )}
              title={he.dripHint}
            >
              🔓 {he.dripAdvancedToggle}
            </button>
            <button
              onClick={() => deleteModule(mod.id)}
              className="text-xs font-medium text-muted hover:text-danger transition-colors"
            >
              {he.delete}
            </button>
          </div>

          {dripOpenIds.has(mod.id) && (
            <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-line bg-paper/30 text-xs text-muted">
              <label className="flex items-center gap-1.5" title={he.dripHint}>
                {he.dripDaysLabel}
                <input
                  type="number"
                  min={0}
                  defaultValue={mod.dripDays ?? 0}
                  aria-label={he.dripDaysLabel}
                  className="w-14 bg-card border border-line rounded-lg px-2 py-1 text-sm text-center outline-none focus:border-brand-300"
                  onBlur={(e) => {
                    const v = Math.max(0, parseInt(e.target.value || '0', 10) || 0);
                    if (v !== (mod.dripDays ?? 0)) setDripDays(mod.id, v);
                  }}
                />
              </label>
              <SavedFlash shown={savedKey === `module-drip-${mod.id}`} />
              <span>{he.dripHint}</span>
            </div>
          )}

          <ul className="divide-y divide-line/70">
            {mod.lessons.map((lesson, li) => (
              <li key={lesson.id} className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col shrink-0" aria-hidden>
                    <button
                      type="button"
                      onClick={() => moveLesson(mod, li, -1)}
                      disabled={li === 0}
                      aria-label={he.moveUp}
                      className="text-muted hover:text-ink disabled:opacity-25 disabled:hover:text-muted leading-none px-0.5 text-xs"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveLesson(mod, li, 1)}
                      disabled={li === mod.lessons.length - 1}
                      aria-label={he.moveDown}
                      className="text-muted hover:text-ink disabled:opacity-25 disabled:hover:text-muted leading-none px-0.5 text-xs"
                    >
                      ▼
                    </button>
                  </div>
                  <span
                    className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-sm shrink-0"
                    aria-hidden
                  >
                    {lesson.videoPublicId ? '🎬' : '📄'}
                  </span>
                  <button
                    className="text-start flex-1 font-medium hover:text-brand-700 transition-colors"
                    onClick={() => setOpenLesson(openLesson === lesson.id ? null : lesson.id)}
                    aria-expanded={openLesson === lesson.id}
                  >
                    {lesson.title}
                  </button>
                  {lesson.attachments.length > 0 && (
                    <span className="text-xs text-muted">📎 {lesson.attachments.length}</span>
                  )}
                  <button
                    onClick={() => deleteLesson(lesson.id)}
                    className="text-xs font-medium text-muted hover:text-danger transition-colors"
                  >
                    {he.delete}
                  </button>
                </div>

                {openLesson === lesson.id && (
                  <div className="mt-3 space-y-3 bg-paper/70 border border-line rounded-xl p-4">
                    <div className="flex items-center gap-2.5">
                      <Input
                        defaultValue={lesson.title}
                        aria-label={he.lessonTitle}
                        className="flex-1"
                        onBlur={(e) => {
                          if (e.target.value.trim() && e.target.value !== lesson.title) {
                            patchLesson(lesson.id, { title: e.target.value.trim() }, `lesson-title-${lesson.id}`);
                          }
                        }}
                      />
                      <SavedFlash shown={savedKey === `lesson-title-${lesson.id}`} />
                    </div>
                    <div className="space-y-1">
                      <textarea
                        className="w-full bg-card border border-line rounded-xl px-3.5 py-2.5 text-sm resize-y outline-none focus:border-brand-500"
                        placeholder={he.lessonNotes}
                        rows={3}
                        defaultValue={lesson.notes ?? ''}
                        onBlur={(e) => {
                          if (e.target.value !== (lesson.notes ?? '')) {
                            patchLesson(lesson.id, { notes: e.target.value || null }, `lesson-notes-${lesson.id}`);
                          }
                        }}
                      />
                      <SavedFlash shown={savedKey === `lesson-notes-${lesson.id}`} />
                    </div>
                    <MediaUploader
                      courseId={courseId}
                      lessonId={lesson.id}
                      hasVideo={Boolean(lesson.videoPublicId)}
                      attachments={lesson.attachments}
                      onChanged={reload}
                    />
                  </div>
                )}
              </li>
            ))}
            <li className="px-5 py-3.5 space-y-2.5">
              <NewLessonForm onAdd={(title) => addLesson(mod.id, title)} />
              {bulkOpenIds.has(mod.id) ? (
                <BulkLessonForm
                  onAdd={(titles) => {
                    addLessonsBulk(mod.id, titles);
                    toggleBulk(mod.id);
                  }}
                  onCancel={() => toggleBulk(mod.id)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleBulk(mod.id)}
                  className="text-xs font-medium text-muted hover:text-brand-700 transition-colors"
                >
                  + {he.bulkAddLessonsToggle}
                </button>
              )}
            </li>
          </ul>
        </section>
      ))}

      <form onSubmit={addModule} className="flex gap-2 max-w-md">
        <Input
          placeholder={he.moduleTitle}
          value={newModule}
          onChange={(e) => setNewModule(e.target.value)}
        />
        <Button type="submit" variant="secondary">
          + {he.newModule}
        </Button>
      </form>
    </div>
  );
}

function NewLessonForm({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) {
          onAdd(title.trim());
          setTitle('');
        }
      }}
      className="flex gap-2 max-w-md"
    >
      <Input
        placeholder={he.lessonTitle}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="!py-1.5"
      />
      <Button type="submit" variant="secondary" size="sm" className="shrink-0">
        + {he.newLesson}
      </Button>
    </form>
  );
}

function BulkLessonForm({
  onAdd,
  onCancel,
}: {
  onAdd: (titles: string[]) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const titles = text
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean);
        if (titles.length) onAdd(titles);
      }}
      className="max-w-md space-y-2 bg-paper/70 border border-line rounded-xl p-3"
    >
      <p className="text-xs font-medium">{he.bulkAddLessons}</p>
      <textarea
        className="w-full bg-card border border-line rounded-xl px-3.5 py-2.5 text-sm resize-y outline-none focus:border-brand-500"
        rows={4}
        placeholder={he.bulkAddLessonsPlaceholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="text-xs text-muted">{he.bulkAddLessonsHint}</p>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          {he.bulkAddLessonsSubmit}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {he.cancel}
        </Button>
      </div>
    </form>
  );
}
