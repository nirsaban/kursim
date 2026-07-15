'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { apiFetch } from '@/lib/client/api';
import { relativeHe } from '@/lib/relative-time';
import { he } from '@/lib/he';

export interface QAItem {
  id: string;
  studentName: string;
  body: string;
  answer: string;
  answeredAt: string | null;
  createdAt: string;
}

export default function LessonQA({
  lessonId,
  isStudent,
  isStaff,
  initialQuestions,
}: {
  lessonId: string;
  isStudent: boolean;
  isStaff: boolean;
  initialQuestions: QAItem[];
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (body.trim().length < 3 || busy) return;
    setBusy(true);
    const res = await apiFetch('/api/lesson-questions', {
      method: 'POST',
      body: JSON.stringify({ lessonId, body }),
    });
    setBusy(false);
    if (res.ok) {
      setBody('');
      router.refresh();
    }
  }

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold mb-4">{he.lessonQa}</h2>

      {isStudent && (
        <div className="bg-card border border-line rounded-xl2 shadow-card p-4 mb-5">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={he.questionPlaceholder}
            rows={3}
          />
          <div className="flex justify-end mt-3">
            <Button onClick={ask} disabled={busy || body.trim().length < 3}>
              {he.sendQuestion}
            </Button>
          </div>
        </div>
      )}

      {initialQuestions.length === 0 ? (
        <EmptyState icon="💬" title={he.qaEmpty} />
      ) : (
        <ul className="space-y-3">
          {initialQuestions.map((q) => (
            <li key={q.id} className="bg-card border border-line rounded-xl2 shadow-card p-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-ink">{q.studentName}</span>
                <span className="text-xs text-muted">{relativeHe(new Date(q.createdAt).getTime())}</span>
                {q.answer ? (
                  <Badge tone="ok" className="ms-auto">{he.qaAnswered}</Badge>
                ) : (
                  <Badge tone="warn" className="ms-auto">{he.qaWaiting}</Badge>
                )}
              </div>
              <p className="mt-2 text-ink leading-relaxed whitespace-pre-wrap">{q.body}</p>

              {q.answer && (
                <div className="mt-3 ps-4 border-s-2 border-brand-300 bg-paper rounded-e-xl py-2.5 pe-3">
                  <p className="kicker mb-1">{he.qaAnswerLabel}</p>
                  <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{q.answer}</p>
                </div>
              )}

              {isStaff && !q.answer && <AnswerForm questionId={q.id} onDone={() => router.refresh()} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AnswerForm({ questionId, onDone }: { questionId: string; onDone: () => void }) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!answer.trim() || busy) return;
    setBusy(true);
    const res = await apiFetch(`/api/lesson-questions/${questionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    });
    setBusy(false);
    if (res.ok) {
      setAnswer('');
      onDone();
    }
  }

  return (
    <div className="mt-3">
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={he.qaAnswerPlaceholder}
        rows={2}
      />
      <div className="flex justify-end mt-2">
        <Button size="sm" onClick={submit} disabled={busy || !answer.trim()}>
          {he.qaAnswerSend}
        </Button>
      </div>
    </div>
  );
}
