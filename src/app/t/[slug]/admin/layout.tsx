import { notFound, redirect } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import SessionWatcher from '@/components/SessionWatcher';
import Navbar, { NavEntry } from '@/components/Navbar';
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

  // Owners get a compact grouped bar; instructors a minimal one.
  const links: NavEntry[] =
    auth.role === 'OWNER'
      ? [
          { href: `/t/${slug}/admin`, label: he.dashboard, exact: true },
          { href: `/t/${slug}/admin/courses`, label: he.courses },
          {
            label: he.students,
            liveDot: true,
            items: [
              { href: `/t/${slug}/admin/students`, label: he.students },
              { href: `/t/${slug}/admin/sessions`, label: he.sessions, liveDot: true },
              { href: `/t/${slug}/community`, label: he.community },
            ],
          },
          {
            label: he.navMarketing,
            items: [
              { href: `/t/${slug}/admin/payments`, label: he.payments },
              { href: `/t/${slug}/admin/broadcasts`, label: he.broadcasts },
              { href: `/t/${slug}/admin/access-codes`, label: he.accessCodes },
              { href: `/t/${slug}/admin/analytics`, label: he.analytics },
            ],
          },
          {
            label: he.settings,
            items: [
              { href: `/t/${slug}/admin/homepage`, label: he.homepageBuilder },
              { href: `/t/${slug}/admin/whatsapp`, label: he.whatsappTitle },
              { href: `/t/${slug}/admin/settings`, label: he.settings },
            ],
          },
        ]
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
