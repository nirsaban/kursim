import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';

export async function loadLanding(slug: string, courseId: string) {
  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status !== 'ACTIVE') return null;
  const course = await forTenant(tenant.id).course.findFirst({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { sortOrder: 'asc' },
        include: { lessons: { orderBy: { sortOrder: 'asc' }, select: { id: true, title: true, durationSec: true } } },
      },
    },
  });
  if (!course) return null;
  return { tenant, course };
}
