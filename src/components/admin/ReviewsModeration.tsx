'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { he } from '@/lib/he';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Field, Input, Textarea } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';

interface Review {
  id: string;
  name: string;
  rating: number;
  text: string;
  privateNote: string;
  approved: boolean;
  createdAt: string;
  student: { email: string };
}

export default function ReviewsModeration({ courseId }: { courseId: string }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', rating: 5, text: '' });
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);

  const reload = useCallback(async () => {
    const res = await apiFetch(`/api/courses/${courseId}/reviews`);
    if (res.ok) setReviews((await res.json()).reviews);
  }, [courseId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function patch(id: string, body: Record<string, unknown>) {
    await apiFetch(`/api/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    reload();
  }

  async function remove(id: string) {
    await apiFetch(`/api/reviews/${id}`, { method: 'DELETE' });
    reload();
  }

  async function confirmRemove() {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    setDeleteTarget(null);
  }

  function startEdit(r: Review) {
    setEditing(r.id);
    setDraft({ name: r.name, rating: r.rating, text: r.text });
  }

  async function saveEdit(id: string, approveToo: boolean) {
    await patch(id, { ...draft, ...(approveToo ? { approved: true } : {}) });
    setEditing(null);
  }

  if (!reviews) return <div className="h-24 rounded-xl bg-ink/[0.04] animate-pulse" />;
  if (reviews.length === 0) {
    return (
      <EmptyState
        icon="⭐"
        title={he.noReviews}
        hint={he.reviewsEmptyHint}
      />
    );
  }

  return (
    <>
    <ul className="divide-y divide-line/70">
      {reviews.map((r) => (
        <li key={r.id} className="py-4 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-warn" aria-label={`${r.rating}/5`}>
              {'★'.repeat(r.rating)}
              <span className="text-line">{'★'.repeat(5 - r.rating)}</span>
            </span>
            <span className="font-semibold text-sm">{r.name || he.verifiedStudent}</span>
            <span className="text-xs text-muted" dir="ltr">
              {r.student.email}
            </span>
            <Badge tone={r.approved ? 'ok' : 'warn'}>
              {r.approved ? he.reviewApproved : he.reviewPending}
            </Badge>
            <div className="ms-auto flex items-center gap-2">
              {editing !== r.id && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => startEdit(r)}>
                    ✎ {he.reviewEdit}
                  </Button>
                  <Button
                    size="sm"
                    variant={r.approved ? 'secondary' : 'primary'}
                    onClick={() => patch(r.id, { approved: !r.approved })}
                  >
                    {r.approved ? he.reviewHide : he.reviewApprove}
                  </Button>
                </>
              )}
              <button
                onClick={() => setDeleteTarget(r)}
                className="text-xs font-medium text-muted hover:text-danger transition-colors"
              >
                {he.delete}
              </button>
            </div>
          </div>

          {editing === r.id ? (
            <div className="mt-3 bg-paper/70 border border-line rounded-xl p-4 space-y-3">
              <p className="text-xs text-muted">{he.reviewEditNote}</p>
              <div className="flex flex-wrap gap-3">
                <Field label={he.testimonialName} className="flex-1 min-w-40">
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </Field>
                <Field label={he.reviewRating}>
                  <div className="flex gap-0.5 pt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setDraft({ ...draft, rating: star })}
                        className={cn(
                          'text-2xl transition-transform hover:scale-110',
                          star <= draft.rating ? 'text-warn' : 'text-line',
                        )}
                        aria-label={`${star}/5`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <Field label={he.reviewText}>
                <Textarea
                  rows={3}
                  value={draft.text}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                />
              </Field>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveEdit(r.id, !r.approved)}>
                  {r.approved ? he.save : `${he.save} + ${he.reviewApprove}`}
                </Button>
                {!r.approved && (
                  <Button size="sm" variant="secondary" onClick={() => saveEdit(r.id, false)}>
                    {he.save}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  {he.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted mt-2 leading-relaxed">{r.text}</p>
              {r.privateNote && (
                <div className="mt-2 flex items-start gap-2 bg-warn/5 border border-warn/20 rounded-lg px-3 py-2">
                  <Badge tone="warn">{he.privateNoteBadge}</Badge>
                  <p className="text-sm text-muted leading-relaxed">{r.privateNote}</p>
                </div>
              )}
            </>
          )}
        </li>
      ))}
    </ul>

    <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title={he.delete}>
      <div className="space-y-4">
        <p className="text-sm font-medium">{he.confirmDelete}</p>
        <div className="flex gap-2">
          <Button type="button" variant="danger" onClick={confirmRemove}>
            {he.delete}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
            {he.cancel}
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
}
