import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { publicIdBelongsToCourse } from '@/lib/cloudinary/sign-upload';
import { z } from 'zod';

type Params = { params: Promise<{ lessonId: string }> };

const bodySchema = z.object({
  publicId: z.string().min(1).max(512),
  filename: z.string().min(1).max(255),
  kind: z.enum(['DOC', 'IMAGE', 'OTHER']).default('OTHER'),
});

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { lessonId } = await params;
  const parsed = await parseBody(req, bodySchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId },
    include: { module: true },
  });
  if (!lesson) return apiError(404, 'not_found');

  if (!publicIdBelongsToCourse(parsed.data.publicId, auth.tenantId!, lesson.module.courseId)) {
    return apiError(400, 'public_id_outside_tenant_folder');
  }

  const attachment = await db.attachment.create({
    data: {
      tenantId: auth.tenantId!,
      lessonId: lesson.id,
      publicId: parsed.data.publicId,
      filename: parsed.data.filename,
      kind: parsed.data.kind,
    },
  });
  return NextResponse.json({ attachment }, { status: 201 });
}
