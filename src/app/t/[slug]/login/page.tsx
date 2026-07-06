import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import LoginForm from '@/components/LoginForm';
import AuthShell from '@/components/AuthShell';
import { he } from '@/lib/he';

export default async function TenantLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  return (
    <AuthShell
      title={tenant.name}
      subtitle={he.login}
      panelTitle="הלמידה שלכם, במקום אחד"
      panelText="קורסים, שיעורי וידאו וחומרי לימוד — זמינים מכל מכשיר, עם התקדמות שנשמרת אוטומטית."
    >
      <Suspense>
        <LoginForm tenantSlug={slug} />
      </Suspense>
    </AuthShell>
  );
}
