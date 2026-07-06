import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { lessonSchema } from '@/lib/validation/schemas';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { destroyPublicIds } from '@/lib/cloudinary/cleanup';

type Params = { params: Promise<{ lessonId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { lessonId } = await params;
  const parsed = await parseBody(req, lessonSchema.partial());
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const existing = await db.lesson.findFirst({ where: { id: lessonId } });
  if (!existing) return apiError(404, 'not_found');

  const lesson = await db.lesson.update({ where: { id: lessonId }, data: parsed.data });
  return NextResponse.json({ lesson });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { lessonId } = await params;

  const db = forTenant(auth.tenantId!);
  const existing = await db.lesson.findFirst({
    where: { id: lessonId },
    include: { attachments: true },
  });
  if (!existing) return apiError(404, 'not_found');

  await db.lesson.delete({ where: { id: lessonId } });
  const publicIds = [
    ...(existing.videoPublicId ? [{ publicId: existing.videoPublicId, video: true }] : []),
    ...existing.attachments.map((a) => ({ publicId: a.publicId, video: false })),
  ];
  destroyPublicIds(publicIds).catch(() => {});
  return NextResponse.json({ ok: true });
}
