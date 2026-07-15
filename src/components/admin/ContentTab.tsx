'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
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
    reload();
  }

  async function setDripDays(id: string, dripDays: number) {
    await apiFetch(`/api/modules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ dripDays }),
    });
    reload();
  }

  async function addLesson(moduleId: string, title: string) {
    await apiFetch(`/api/modules/${moduleId}/lessons`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    reload();
  }

  async function patchLesson(id: string, data: Record<string, unknown>) {
    await apiFetch(`/api/lessons/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    reload();
  }

  async function deleteLesson(id: string) {
    if (!confirm(he.confirmDelete)) return;
    await apiFetch(`/api/lessons/${id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div className="space-y-5">
      {course.modules.length === 0 && (
        <EmptyState
          icon="📦"
          title={he.noLessons}
          hint={he.modulesEmptyHint}
        />
      )}

      {course.modules.map((mod, mi) => (
        <section key={mod.id} className="bg-card border border-line rounded-xl2 shadow-card">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-line bg-paper/50 rounded-t-xl2">
            <span className="kicker shrink-0">
              {he.modules} {mi + 1}
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
            <label
              className="flex items-center gap-1.5 text-xs text-muted shrink-0"
              title={he.dripHint}
            >
              <span aria-hidden>🔓</span>
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
            <button
              onClick={() => deleteModule(mod.id)}
              className="text-xs font-medium text-muted hover:text-danger transition-colors"
            >
              {he.delete}
            </button>
          </div>

          <ul className="divide-y divide-line/70">
            {mod.lessons.map((lesson) => (
              <li key={lesson.id} className="px-5 py-3.5">
                <div className="flex items-center gap-3">
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
                    <Input
                      defaultValue={lesson.title}
                      aria-label={he.lessonTitle}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== lesson.title) {
                          patchLesson(lesson.id, { title: e.target.value.trim() });
                        }
                      }}
                    />
                    <textarea
                      className="w-full bg-card border border-line rounded-xl px-3.5 py-2.5 text-sm resize-y outline-none focus:border-brand-500"
                      placeholder={he.lessonNotes}
                      rows={3}
                      defaultValue={lesson.notes ?? ''}
                      onBlur={(e) => {
                        if (e.target.value !== (lesson.notes ?? '')) {
                          patchLesson(lesson.id, { notes: e.target.value || null });
                        }
                      }}
                    />
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
            <li className="px-5 py-3.5">
              <NewLessonForm onAdd={(title) => addLesson(mod.id, title)} />
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
      <button className="text-sm font-semibold text-brand-700 hover:underline whitespace-nowrap">
        + {he.newLesson}
      </button>
    </form>
  );
}
