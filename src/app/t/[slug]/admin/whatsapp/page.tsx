import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import PageHeader from '@/components/ui/PageHeader';
import WhatsappPanel, { WaMessageRow } from '@/components/admin/WhatsappPanel';
import { he } from '@/lib/he';

export default async function AdminWhatsappPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);
  if (auth.role !== 'OWNER') redirect(`/t/${slug}`);
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const rows = await forTenant(tenant.id).whatsappMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const messages: WaMessageRow[] = rows.map((m) => ({
    id: m.id,
    toPhone: m.toPhone,
    body: m.body,
    status: m.status,
    error: m.error,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="max-w-3xl">
      <PageHeader title={he.whatsappTitle} subtitle={he.whatsappOwnerSubtitle} />
      <WhatsappPanel messages={messages} />
    </div>
  );
}
