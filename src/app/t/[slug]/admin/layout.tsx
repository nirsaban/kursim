import { notFound, redirect } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import SessionWatcher from '@/components/SessionWatcher';
import Navbar, { NavLink } from '@/components/Navbar';
import { he } from '@/lib/he';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const auth = await getAuth();
  if (!auth || auth.tenantSlug !== slug) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER' && auth.role !== 'INSTRUCTOR') redirect(`/t/${slug}`);

  const user = await forTenant(tenant.id).user.findFirst({
    where: { id: auth.userId },
    select: { email: true },
  });

  const links: NavLink[] = [
    { href: `/t/${slug}/admin`, label: he.dashboard, exact: true },
    { href: `/t/${slug}/admin/courses`, label: he.courses },
    ...(auth.role === 'OWNER'
      ? [
          { href: `/t/${slug}/admin/students`, label: he.students },
          { href: `/t/${slug}/admin/sessions`, label: he.sessions, liveDot: true },
          { href: `/t/${slug}/admin/settings`, label: he.settings },
        ]
      : []),
    { href: `/t/${slug}`, label: he.myCourses, exact: true },
  ];

  return (
    <div className="min-h-screen">
      <SessionWatcher />
      <Navbar
        brandName={tenant.name}
        brandHref={`/t/${slug}/admin`}
        links={links}
        roleLabel={he.admin}
        userEmail={user?.email}
        changePasswordHref={`/t/${slug}/change-password`}
        tone="ink"
      />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
