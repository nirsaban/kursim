import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { asSuperAdmin } from '@/lib/tenant/scoped-prisma';
import { hashAuthToken } from '@/lib/auth/tokens';
import ResetForm from '@/components/ResetForm';
import AuthShell from '@/components/AuthShell';
import { he } from '@/lib/he';

// The token check hits the database on every view — never cache this page.
export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  // Check validity up front so a stale link says so immediately, instead of
  // after the visitor has typed out a new password. Redeeming still happens in
  // /api/auth/reset — this read never consumes the token.
  const record = await asSuperAdmin().authToken.findFirst({
    where: { tokenHash: hashAuthToken(token) },
    select: { usedAt: true, expiresAt: true, tenantId: true },
  });
  const valid =
    Boolean(record) &&
    !record!.usedAt &&
    record!.expiresAt > new Date() &&
    record!.tenantId === tenant.id;

  return (
    <AuthShell
      orgName={tenant.name}
      title={valid ? he.resetTitle : he.resetInvalidTitle}
      subtitle={valid ? he.resetSubtitle : undefined}
      panelTitle={he.authPanelTitle}
      panelText={he.authPanelText}
    >
      {valid ? (
        <ResetForm tenantSlug={slug} token={token} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted">{he.resetInvalidBody}</p>
          <Link
            href={`/t/${slug}/forgot`}
            className="inline-flex items-center justify-center w-full rounded-xl bg-copper-500 text-white font-bold px-5 py-3 hover:bg-copper-600 transition-colors"
          >
            {he.forgotSubmit}
          </Link>
          <Link
            href={`/t/${slug}/login`}
            className="block text-center text-sm text-muted hover:text-ink"
          >
            {he.backToLogin}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
