import { notFound, redirect } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseTerms, termsGateBlocks } from '@/lib/validation/branding';
import AcceptTermsForm from '@/components/AcceptTermsForm';
import AuthShell from '@/components/AuthShell';
import { he } from '@/lib/he';

/**
 * The terms gate: students land here (from the app layout) until they accept
 * the academy's current terms version.
 */
export default async function TermsGatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const auth = await getAuth();
  if (!auth || auth.tenantSlug !== slug) redirect(`/t/${slug}/login`);

  const terms = parseTerms(tenant.terms);
  const user = await forTenant(tenant.id).user.findFirst({
    where: { id: auth.userId },
    select: { acceptedTermsAt: true, acceptedTermsVersion: true },
  });
  if (!user || !termsGateBlocks(terms, user)) redirect(`/t/${slug}`);

  return (
    <AuthShell
      orgName={tenant.name}
      title={terms.title || he.termsDefaultTitle}
      subtitle={he.termsGateSubtitle}
      panelTitle={he.authPanelTitle}
      panelText={he.authPanelText}
    >
      <div className="space-y-5">
        {terms.body && (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-line bg-brand-50 p-4 text-sm text-ink leading-relaxed whitespace-pre-line">
            {terms.body}
          </div>
        )}
        {terms.url && (
          <a
            href={terms.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-copper-600 hover:text-copper-700"
          >
            📄 {he.termsFullLink} ↗
          </a>
        )}
        <AcceptTermsForm slug={slug} />
      </div>
    </AuthShell>
  );
}
