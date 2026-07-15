import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import AcceptInviteForm from '@/components/AcceptInviteForm';
import AuthShell from '@/components/AuthShell';
import { he } from '@/lib/he';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  return (
    <AuthShell
      title={tenant.name}
      subtitle={he.acceptInviteTitle}
      panelTitle={he.inviteePanelTitle}
      panelText={he.inviteePanelText}
    >
      <AcceptInviteForm token={token} tenantSlug={slug} />
    </AuthShell>
  );
}
