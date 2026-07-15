import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { wishlistSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';

/** The current student's saved course ids. */
export async function GET() {
  const auth = await requireAuth({ roles: ['STUDENT'] });
  if (auth instanceof NextResponse) return auth;
  const items = await forTenant(auth.tenantId!).wishlist.findMany({
    where: { studentId: auth.userId },
    select: { courseId: true },
  });
  return NextResponse.json({ courseIds: items.map((i) => i.courseId) });
}

/** Toggle a course in the wishlist. Returns { saved: boolean }. */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['STUDENT'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, wishlistSchema);
  if ('error' in parsed) return parsed.error;
  const { courseId } = parsed.data;

  const db = forTenant(auth.tenantId!);
  const existing = await db.wishlist.findFirst({
    where: { studentId: auth.userId, courseId },
  });
  if (existing) {
    await db.wishlist.deleteMany({ where: { studentId: auth.userId, courseId } });
    return NextResponse.json({ saved: false });
  }
  await db.wishlist.create({
    data: { tenantId: auth.tenantId!, studentId: auth.userId, courseId },
  });
  return NextResponse.json({ saved: true });
}
