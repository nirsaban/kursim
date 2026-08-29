import { notFound, redirect } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import SessionWatcher from '@/components/SessionWatcher';
import { parseTerms, termsGateBlocks } from '@/lib/validation/branding';

/**
 * Course-taking shell: full-bleed, no site navbar — the lesson page paints
 * its own course header (title + progress) above the video stage.
 */
export default async function LearnLayout({
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
    select: { acceptedTermsAt: true, acceptedTermsVersion: true },
  });
  if (auth.role === 'STUDENT' && user && termsGateBlocks(parseTerms(tenant.terms), user)) {
    redirect(`/t/${slug}/terms`);
  }

  return (
    <div className="min-h-screen bg-paper">
      <SessionWatcher />
      {children}
    </div>
  );
}
