import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import RedeemForm from '@/components/RedeemForm';
import { he } from '@/lib/he';

export default async function RedeemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const auth = await getAuth();
  if (!auth || auth.tenantSlug !== slug) redirect(`/t/${slug}/login`);

  return (
    <div className="max-w-md mx-auto">
      <PageHeader title={he.redeemTitle} subtitle={he.redeemHint} />
      <Card>
        <CardBody>
          <RedeemForm slug={slug} />
        </CardBody>
      </Card>
    </div>
  );
}
