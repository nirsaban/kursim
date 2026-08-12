import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import ForgotForm from '@/components/ForgotForm';
import AuthShell from '@/components/AuthShell';
import { he } from '@/lib/he';

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  return (
    <AuthShell
      orgName={tenant.name}
      title={he.forgotTitle}
      subtitle={he.forgotSubtitle}
      panelTitle={he.authPanelTitle}
      panelText={he.authPanelText}
    >
      <ForgotForm tenantSlug={slug} />
    </AuthShell>
  );
}
