import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { collectionSchema, parseCollectionContent } from '@/lib/validation/collection';
import { syncCrossAddons } from '@/lib/collections';

type Params = { params: Promise<{ collectionId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { collectionId } = await params;
  const db = forTenant(auth.tenantId!);
  const row = await db.courseCollection.findFirst({ where: { id: collectionId } });
  if (!row) return apiError(404, 'not_found');
  return NextResponse.json({
    id: row.id,
    title: row.title,
    courseIds: row.courseIds,
    content: parseCollectionContent(row.content),
    published: row.published,
    views: row.views,
  });
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { collectionId } = await params;
  const parsed = await parseBody(req, collectionSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const existing = await db.courseCollection.findFirst({ where: { id: collectionId } });
  if (!existing) return apiError(404, 'not_found');

  const ids = Array.from(new Set(parsed.data.courseIds));
  const owned = await db.course.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (owned.length !== ids.length) return apiError(400, 'course_not_found');
  if (ids.length < 2) return apiError(400, 'min_two_courses');

  await db.courseCollection.update({
    where: { id: collectionId },
    data: { title: parsed.data.title, courseIds: ids, content: parsed.data.content },
  });
  if (parsed.data.content.crossAddons) await syncCrossAddons(db, ids);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const { collectionId } = await params;
  const db = forTenant(auth.tenantId!);
  const existing = await db.courseCollection.findFirst({ where: { id: collectionId } });
  if (!existing) return apiError(404, 'not_found');
  await db.courseCollection.delete({ where: { id: collectionId } });
  return NextResponse.json({ ok: true });
}
