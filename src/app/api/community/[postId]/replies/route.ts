import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { communityReplySchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { notify } from '@/lib/notify';
import { he } from '@/lib/he';

type Params = { params: Promise<{ postId: string }> };

/** Add a reply to a post and notify its author. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { postId } = await params;
  const parsed = await parseBody(req, communityReplySchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const post = await db.communityPost.findFirst({ where: { id: postId } });
  if (!post) return apiError(404, 'not_found');

  const user = await db.user.findFirst({
    where: { id: auth.userId },
    select: { email: true },
  });
  const authorName = (user?.email ?? '').split('@')[0];

  const reply = await db.communityReply.create({
    data: {
      tenantId: auth.tenantId!,
      postId,
      authorId: auth.userId,
      authorName,
      authorRole: auth.role,
      body: parsed.data.body.trim(),
    },
  });

  await db.communityPost.updateMany({
    where: { id: postId },
    data: { replyCount: { increment: 1 } },
  });

  if (post.authorId !== auth.userId) {
    await notify(db, auth.tenantId!, {
      userId: post.authorId,
      type: 'community_reply',
      title: he.repliesCount,
      body: post.title,
      link: `/t/${auth.tenantSlug}/community/${postId}`,
    });
  }

  return NextResponse.json({ reply }, { status: 201 });
}
