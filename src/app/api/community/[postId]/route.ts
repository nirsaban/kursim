import { NextResponse } from 'next/server';
import { requireAuth, forbidden } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { communityPostModerationSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

type Params = { params: Promise<{ postId: string }> };

/** A single post with its replies. */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { postId } = await params;

  const db = forTenant(auth.tenantId!);
  const post = await db.communityPost.findFirst({ where: { id: postId } });
  if (!post) return apiError(404, 'not_found');

  const replies = await db.communityReply.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ post, replies });
}

/** Staff moderation: pin / unpin a post. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const isStaff = auth.role === 'OWNER' || auth.role === 'INSTRUCTOR';
  if (!isStaff) return forbidden();
  const { postId } = await params;
  const parsed = await parseBody(req, communityPostModerationSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const existing = await db.communityPost.findFirst({ where: { id: postId } });
  if (!existing) return apiError(404, 'not_found');

  await db.communityPost.updateMany({
    where: { id: postId },
    data: { ...(parsed.data.pinned !== undefined ? { pinned: parsed.data.pinned } : {}) },
  });
  const post = await db.communityPost.findFirst({ where: { id: postId } });
  return NextResponse.json({ post });
}

/** Author or staff deletes a post (replies cascade at the DB level). */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { postId } = await params;

  const db = forTenant(auth.tenantId!);
  const post = await db.communityPost.findFirst({ where: { id: postId } });
  if (!post) return apiError(404, 'not_found');

  const isStaff = auth.role === 'OWNER' || auth.role === 'INSTRUCTOR';
  if (!isStaff && post.authorId !== auth.userId) return forbidden();

  await db.communityPost.deleteMany({ where: { id: postId } });
  return NextResponse.json({ ok: true });
}
