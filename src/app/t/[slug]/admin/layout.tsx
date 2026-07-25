import { notFound, redirect } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import SessionWatcher from '@/components/SessionWatcher';
import Navbar, { NavEntry } from '@/components/Navbar';
import { ADMIN_SECTIONS } from '@/lib/admin-sections';
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

  // Owners get the 4-part bar (mirrors the tile layout on /admin and each
  // hub page); instructors keep the minimal one — they only touch courses.
  const links: NavEntry[] =
    auth.role === 'OWNER'
      ? ADMIN_SECTIONS.map((s) => ({
          href: s.href(slug),
          label: s.label,
          liveDot: s.key === 'students',
        }))
      : [
          { href: `/t/${slug}/admin`, label: he.dashboard, exact: true },
          { href: `/t/${slug}/admin/courses`, label: he.courses },
          { href: `/t/${slug}/community`, label: he.community },
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
        notifSlug={slug}
      />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
