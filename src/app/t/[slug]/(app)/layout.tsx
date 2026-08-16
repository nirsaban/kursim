import { notFound, redirect } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import SessionWatcher from '@/components/SessionWatcher';
import Navbar, { NavLink } from '@/components/Navbar';
import { parseBranding, parseTerms, termsGateBlocks } from '@/lib/validation/branding';
import { he } from '@/lib/he';

export default async function TenantAppLayout({
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

  const user = await forTenant(tenant.id).user.findFirst({
    where: { id: auth.userId },
    select: { email: true, acceptedTermsAt: true, acceptedTermsVersion: true },
  });

  // Terms gate: students must accept the academy's current terms first.
  // Staff are exempt — they wrote them.
  if (auth.role === 'STUDENT' && user && termsGateBlocks(parseTerms(tenant.terms), user)) {
    redirect(`/t/${slug}/terms`);
  }

  const links: NavLink[] = [{ href: `/t/${slug}`, label: he.myCourses, exact: true }];
  if (auth.role === 'STUDENT') {
    links.push({ href: `/t/${slug}/journey`, label: he.journeyTitle });
  }
  links.push({ href: `/t/${slug}/community`, label: he.community });
  if (auth.role === 'OWNER' || auth.role === 'INSTRUCTOR') {
    links.push({ href: `/t/${slug}/admin`, label: he.admin });
  }

  const branding = parseBranding(tenant.branding);

  return (
    <div
      className="min-h-screen"
      style={branding.primary ? ({ '--tenant-primary': branding.primary } as React.CSSProperties) : undefined}
    >
      <SessionWatcher />
      <Navbar
        brandName={tenant.name}
        brandHref={`/t/${slug}`}
        brandLogoUrl={branding.logo ?? undefined}
        brandLogoSize={branding.logoSize}
        links={links}
        userEmail={user?.email}
        changePasswordHref={`/t/${slug}/change-password`}
        notifSlug={slug}
      />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
