import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { marketingSchema, parseMarketing } from '@/lib/validation/marketing';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { publicIdBelongsToCourse } from '@/lib/cloudinary/sign-upload';

type Params = { params: Promise<{ courseId: string }> };

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;

  const course = await forTenant(auth.tenantId!).course.findFirst({
    where: { id: courseId },
    select: { id: true, title: true, marketing: true, landingPublished: true },
  });
  if (!course) return apiError(404, 'not_found');

  return NextResponse.json({
    marketing: parseMarketing(course.marketing),
    landingPublished: course.landingPublished,
  });
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await requireAuth({ roles: ['OWNER', 'INSTRUCTOR'] });
  if (auth instanceof NextResponse) return auth;
  const { courseId } = await params;
  const parsed = await parseBody(req, marketingSchema);
  if ('error' in parsed) return parsed.error;

  const db = forTenant(auth.tenantId!);
  const existing = await db.course.findFirst({ where: { id: courseId } });
  if (!existing) return apiError(404, 'not_found');

  // Gallery assets must live inside this tenant's folder for this course —
  // otherwise a crafted publicId could surface another tenant's media.
  for (const item of parsed.data.gallery) {
    if (!publicIdBelongsToCourse(item.publicId, auth.tenantId!, courseId)) {
      return apiError(400, 'public_id_outside_tenant_folder');
    }
    if (item.kind === 'BEFORE_AFTER') {
      if (
        !item.afterPublicId ||
        !publicIdBelongsToCourse(item.afterPublicId, auth.tenantId!, courseId)
      ) {
        return apiError(400, 'public_id_outside_tenant_folder');
      }
    }
  }

  await db.course.update({
    where: { id: courseId },
    data: { marketing: parsed.data },
  });
  return NextResponse.json({ marketing: parsed.data });
}
