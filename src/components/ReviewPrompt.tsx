'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { he } from '@/lib/he';
import { Field, Input, Textarea } from '@/components/ui/Field';
import Button from '@/components/ui/Button';

/** Shown to a student on the course page once every lesson is completed. */
export default function ReviewPrompt({ courseId }: { courseId: string }) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    const res = await apiFetch(`/api/courses/${courseId}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating, name, text, privateNote }),
    });
    setState(res.ok ? 'done' : 'error');
  }

  if (state === 'done') {
    return (
      <div className="bg-ok/10 border border-ok/25 rounded-xl2 p-5 text-ok font-medium">
        ✓ {he.reviewThanks}
      </div>
    );
  }

  return (
    <div className="bg-card border-2 border-brand-200 rounded-xl2 shadow-card p-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-2xl" aria-hidden>
          🎉
        </span>
        <h2 className="font-display text-xl font-bold">{he.writeReview}</h2>
      </div>
      <p className="text-sm text-muted mb-5">{he.writeReviewHint}</p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className="block text-sm font-medium mb-1.5">{he.reviewRating}</span>
          <div className="flex gap-1" role="radiogroup" aria-label={he.reviewRating}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={rating === star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                className={cn(
                  'text-3xl transition-transform hover:scale-110',
                  star <= (hover || rating) ? 'text-warn' : 'text-line',
                )}
              >
                ★
              </button>
            ))}
          </div>
        </div>
        <Field label={`${he.testimonialName} (לא חובה)`}>
          <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={he.reviewText}>
          <Textarea
            required
            minLength={3}
            maxLength={1000}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <Field label={he.reviewPrivateNote} hint={he.reviewPrivateNoteHint}>
          <Textarea
            maxLength={1000}
            rows={2}
            value={privateNote}
            onChange={(e) => setPrivateNote(e.target.value)}
          />
        </Field>
        {state === 'error' && <p className="text-sm text-danger font-medium">{he.error}</p>}
        <Button type="submit" disabled={state === 'busy'}>
          {he.reviewSubmit}
        </Button>
      </form>
    </div>
  );
}
