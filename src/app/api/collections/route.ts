import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { collectionSchema } from '@/lib/validation/collection';
import { syncCrossAddons } from '@/lib/collections';

/** Owner lists / creates combined landing pages. */
export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const rows = await forTenant(auth.tenantId!).courseCollection.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, courseIds: true, published: true, views: true, createdAt: true },
  });
  return NextResponse.json({ collections: rows });
}

export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, collectionSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const ids = Array.from(new Set(parsed.data.courseIds));
  const owned = await db.course.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (owned.length !== ids.length) return apiError(400, 'course_not_found');
  if (ids.length < 2) return apiError(400, 'min_two_courses');
  const content = {
    ...parsed.data.content,
    primaryCourseId: ids.includes(parsed.data.content.primaryCourseId)
      ? parsed.data.content.primaryCourseId
      : ids[0],
  };

  const created = await db.courseCollection.create({
    data: {
      tenantId: auth.tenantId!,
      title: parsed.data.title,
      courseIds: ids,
      content,
    },
    select: { id: true },
  });
  if (parsed.data.content.crossAddons) await syncCrossAddons(db, ids);
  return NextResponse.json({ id: created.id }, { status: 201 });
}
