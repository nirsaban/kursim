import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { he } from '@/lib/he';

export default async function CertificatesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const db = forTenant(auth.tenantId!);
  const certificates = await db.certificate.findMany({
    where: { studentId: auth.userId },
    orderBy: { issuedAt: 'desc' },
  });

  return (
    <div>
      <PageHeader kicker={he.myCourses} title={he.certificatesTitle} />

      {certificates.length === 0 ? (
        <EmptyState icon="🎓" title={he.noCertificates} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {certificates.map((c) => (
            <Card key={c.id} className="p-5 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="text-3xl" aria-hidden>
                  🎓
                </span>
                <div className="min-w-0">
                  <p className="font-display font-bold text-lg text-ink truncate">
                    {c.courseTitle}
                  </p>
                  <p className="text-sm text-muted mt-1">
                    {he.certificateIssuedOn}{' '}
                    <span dir="ltr" className="tabular-nums">
                      {new Date(c.issuedAt).toLocaleDateString('he-IL')}
                    </span>
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {he.certificateSerial}{' '}
                    <span dir="ltr" className="font-mono">
                      {c.serial}
                    </span>
                  </p>
                </div>
              </div>
              <Link
                href={`/t/${slug}/certificate/${c.courseId}`}
                className="mt-auto inline-flex items-center justify-center bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold rounded-xl px-4 py-2 transition-colors"
              >
                {he.viewCertificate}
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
