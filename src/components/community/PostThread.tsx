'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { relativeHe } from '@/lib/relative-time';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { Card, CardBody } from '@/components/ui/Card';
import type { CommunityPost } from './CommunityBoard';

export interface CommunityReply {
  id: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

function isStaffRole(role: string) {
  return role === 'OWNER' || role === 'INSTRUCTOR';
}

export default function PostThread({
  slug,
  post,
  initialReplies,
  isStaff,
  currentUserId,
}: {
  slug: string;
  post: CommunityPost & { authorId: string };
  initialReplies: CommunityReply[];
  isStaff: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canDelete = isStaff || post.authorId === currentUserId;

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setReplyError(null);
    const res = await apiFetch(`/api/community/${post.id}/replies`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    setBusy(false);
    if (res.ok) {
      setBody('');
      router.refresh();
    } else {
      setReplyError(he.error);
    }
  }

  async function togglePin() {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    const res = await apiFetch(`/api/community/${post.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned: !post.pinned }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setActionError(he.error);
    }
  }

  async function remove() {
    if (busy) return;
    if (!confirm(he.confirmDelete)) return;
    setBusy(true);
    setActionError(null);
    const res = await apiFetch(`/api/community/${post.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push(`/t/${slug}/community`);
    } else {
      setBusy(false);
      setActionError(he.error);
    }
  }

  return (
    <div>
      <Link
        href={`/t/${slug}/community`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors mb-5"
      >
        <span aria-hidden>→</span>
        {he.backToCommunity}
      </Link>

      <Card className="mb-6">
        <CardBody>
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-xl font-bold text-ink">{post.title}</h1>
            {post.pinned && <Badge tone="copper">{he.pinnedBadge}</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted flex-wrap">
            <span className="font-medium text-ink">{post.authorName}</span>
            {isStaffRole(post.authorRole) && <Badge tone="brand">{he.roleOwnerBadge}</Badge>}
            <span>{relativeHe(new Date(post.createdAt).getTime())}</span>
          </div>
          <p className="text-ink mt-4 leading-relaxed whitespace-pre-wrap">{post.body}</p>

          {(isStaff || canDelete) && (
            <div className="mt-5 pt-4 border-t border-line">
              <div className="flex items-center gap-2">
                {isStaff && (
                  <Button size="sm" variant="secondary" onClick={togglePin} disabled={busy}>
                    {post.pinned ? he.unpinPost : he.pinPost}
                  </Button>
                )}
                {canDelete && (
                  <Button size="sm" variant="danger" onClick={remove} disabled={busy}>
                    {he.deletePost}
                  </Button>
                )}
              </div>
              {actionError && (
                <p className="text-sm text-danger font-medium mt-2">{actionError}</p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <ul className="space-y-3 mb-6">
        {initialReplies.map((reply) => (
          <li key={reply.id}>
            <Card>
              <CardBody className="py-4">
                <div className="flex items-center gap-3 text-xs text-muted flex-wrap mb-2">
                  <span className="font-medium text-ink">{reply.authorName}</span>
                  {isStaffRole(reply.authorRole) && (
                    <Badge tone="brand">{he.roleOwnerBadge}</Badge>
                  )}
                  <span>{relativeHe(new Date(reply.createdAt).getTime())}</span>
                </div>
                <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                  {reply.body}
                </p>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      <Card>
        <CardBody>
          <form onSubmit={sendReply} className="space-y-3">
            <Textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={he.replyPlaceholder}
              maxLength={5000}
            />
            {replyError && <p className="text-sm text-danger font-medium">{replyError}</p>}
            <Button type="submit" disabled={busy || !body.trim()}>
              {he.send}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
