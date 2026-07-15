'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';

export default function LessonNotes({
  lessonId,
  courseId,
  initialBody,
}: {
  lessonId: string;
  courseId: string;
  initialBody: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    const res = await apiFetch('/api/lesson-notes', {
      method: 'PUT',
      body: JSON.stringify({ lessonId, courseId, body }),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <section className="mt-8">
      <div className="bg-card border border-line rounded-xl2 shadow-card p-5">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h2 className="font-display text-lg font-bold">{he.lessonNotesLabel}</h2>
          {saved && <span className="text-xs font-semibold text-ok">{he.notesSaved}</span>}
        </div>
        <p className="text-sm text-muted mb-3">{he.lessonNotesHint}</p>
        <Textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setSaved(false);
          }}
          placeholder={he.notesPlaceholder}
          rows={4}
        />
        <div className="flex justify-end mt-3">
          <Button variant="secondary" onClick={save} disabled={busy}>
            {he.saveNote}
          </Button>
        </div>
      </div>
    </section>
  );
}
