import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import PageHeader from '@/components/ui/PageHeader';
import AccessCodesPanel from '@/components/admin/AccessCodesPanel';
import { he } from '@/lib/he';

export default async function AdminAccessCodesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const auth = await getAuth();
  if (!auth || auth.tenantSlug !== slug) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}`);

  const db = forTenant(auth.tenantId!);
  const [rawCodes, courses] = await Promise.all([
    db.accessCode.findMany({ orderBy: { createdAt: 'desc' } }),
    db.course.findMany({ select: { id: true, title: true } }),
  ]);

  const titles = new Map(courses.map((c) => [c.id, c.title]));
  const initialCodes = rawCodes.map((c) => ({
    id: c.id,
    code: c.code,
    courseId: c.courseId,
    courseTitle: titles.get(c.courseId) ?? null,
    maxUses: c.maxUses,
    uses: c.uses,
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        kicker={he.admin}
        title={he.accessCodes}
        subtitle={he.accessCodesSubtitle}
      />
      <AccessCodesPanel courses={courses} initialCodes={initialCodes} />
    </div>
  );
}
