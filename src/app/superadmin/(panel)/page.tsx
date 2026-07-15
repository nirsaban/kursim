import TenantsManager from '@/components/admin/TenantsManager';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { asSuperAdmin } from '@/lib/tenant/scoped-prisma';
import { he } from '@/lib/he';

export default async function SuperAdminHome() {
  const db = asSuperAdmin();
  const [tenants, activeTenants, users, courses] = await Promise.all([
    db.tenant.count(),
    db.tenant.count({ where: { status: 'ACTIVE' } }),
    db.user.count({ where: { role: { not: 'SUPER_ADMIN' } } }),
    db.course.count(),
  ]);

  return (
    <div>
      <PageHeader kicker={he.superAdmin} title={he.tenants} subtitle={he.tenantsSubtitle} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label={he.totalTenants} value={tenants} sub={`${activeTenants} ${he.active}`} />
        <StatCard label={he.totalUsers} value={users} />
        <StatCard label={he.totalCoursesStat} value={courses} />
        <StatCard label={he.platformStats} value={`${activeTenants}/${tenants}`} />
      </div>
      <TenantsManager />
    </div>
  );
}
