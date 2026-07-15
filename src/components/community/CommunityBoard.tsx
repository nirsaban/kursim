'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { he } from '@/lib/he';
import { relativeHe } from '@/lib/relative-time';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Card, CardBody } from '@/components/ui/Card';

export interface CommunityPost {
  id: string;
  authorName: string;
  authorRole: string;
  title: string;
  body: string;
  pinned: boolean;
  replyCount: number;
  createdAt: string;
}

function isStaffRole(role: string) {
  return role === 'OWNER' || role === 'INSTRUCTOR';
}

export default function CommunityBoard({
  slug,
  initialPosts,
  isStaff,
}: {
  slug: string;
  initialPosts: CommunityPost[];
  isStaff: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  // isStaff is accepted for parity with the page/thread; the board itself
  // renders the same for everyone (moderation lives inside the thread).
  void isStaff;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    const res = await apiFetch('/api/community', {
      method: 'POST',
      body: JSON.stringify({ title, body }),
    });
    setBusy(false);
    if (res.ok) {
      setTitle('');
      setBody('');
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <div>
      <div className="mb-6">
        {open ? (
          <Card>
            <CardBody>
              <form onSubmit={submit} className="space-y-4">
                <Field label={he.postTitle}>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    autoFocus
                  />
                </Field>
                <Field label={he.postBody}>
                  <Textarea
                    rows={4}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={5000}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" disabled={busy || !title.trim() || !body.trim()}>
                    {he.postPublish}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    {he.cancel}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        ) : (
          <Button onClick={() => setOpen(true)}>{he.newPost}</Button>
        )}
      </div>

      {initialPosts.length === 0 ? (
        <EmptyState icon="💬" title={he.communityEmpty} />
      ) : (
        <ul className="space-y-3">
          {initialPosts.map((post) => (
            <li key={post.id}>
              <Link href={`/t/${slug}/community/${post.id}`} className="block group">
                <Card className="transition-colors group-hover:border-copper-500/50">
                  <CardBody>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-ink group-hover:text-copper-600 transition-colors">
                        {post.title}
                      </h3>
                      {post.pinned && <Badge tone="copper">{he.pinnedBadge}</Badge>}
                    </div>
                    <p className="text-sm text-muted mt-1 line-clamp-2 leading-relaxed">
                      {post.body}
                    </p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted flex-wrap">
                      <span className="font-medium text-ink">{post.authorName}</span>
                      {isStaffRole(post.authorRole) && (
                        <Badge tone="brand">{he.roleOwnerBadge}</Badge>
                      )}
                      <span>{relativeHe(new Date(post.createdAt).getTime())}</span>
                      <span className="ms-auto tabular-nums">
                        {post.replyCount} {he.repliesCount}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
