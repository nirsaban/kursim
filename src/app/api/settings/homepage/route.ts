import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { apiError, parseBody } from '@/lib/api';
import { homepageSchema, parseHomepage } from '@/lib/validation/homepage';
import { prisma } from '@/lib/tenant/prisma';
import { forTenant } from '@/lib/tenant/scoped-prisma';

export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId! },
    select: { homepage: true },
  });
  if (!tenant) return apiError(404, 'not_found');
  return NextResponse.json({ homepage: parseHomepage(tenant.homepage) });
}

export async function PUT(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, homepageSchema);
  if ('error' in parsed) return parsed.error;

  if (parsed.data.featuredCourseId) {
    const course = await forTenant(auth.tenantId!).course.findFirst({
      where: { id: parsed.data.featuredCourseId, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!course) return apiError(400, 'featured_course_not_found');
  }

  await prisma.tenant.update({
    where: { id: auth.tenantId! },
    data: { homepage: parsed.data },
  });
  return NextResponse.json({ homepage: parsed.data });
}
