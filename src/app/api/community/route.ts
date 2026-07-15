import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { communityPostSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

/** List the tenant's community posts (pinned first, newest first). */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const db = forTenant(auth.tenantId!);
  const posts = await db.communityPost.findMany({
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });
  return NextResponse.json({ posts });
}

/** Any logged-in user opens a new discussion. */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, communityPostSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const user = await db.user.findFirst({
    where: { id: auth.userId },
    select: { email: true },
  });
  const authorName = (user?.email ?? '').split('@')[0];

  const post = await db.communityPost.create({
    data: {
      tenantId: auth.tenantId!,
      authorId: auth.userId,
      authorName,
      authorRole: auth.role,
      title: parsed.data.title.trim(),
      body: parsed.data.body.trim(),
      replyCount: 0,
    },
  });
  return NextResponse.json({ post }, { status: 201 });
}
