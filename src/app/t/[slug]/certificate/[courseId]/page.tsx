import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import CertificatePrint from '@/components/CertificatePrint';
import { he } from '@/lib/he';

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ slug: string; courseId: string }>;
}) {
  const { slug, courseId } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const db = forTenant(auth.tenantId!);

  const course = await db.course.findFirst({
    where: { id: courseId },
    include: { modules: { include: { lessons: { select: { id: true } } } } },
  });
  if (!course) notFound();

  // Must be enrolled AND have completed every lesson in the course.
  const enrolled = await db.enrollment.findFirst({
    where: { studentId: auth.userId, courseId },
  });
  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  let completedAll = false;
  if (enrolled && lessonIds.length > 0) {
    const completed = await db.progress.count({
      where: {
        studentId: auth.userId,
        lessonId: { in: lessonIds },
        completedAt: { not: null },
      },
    });
    completedAll = completed === lessonIds.length;
  }
  if (!completedAll) redirect(`/t/${slug}/course/${courseId}`);

  // Auto-issue on first view.
  let certificate = await db.certificate.findFirst({
    where: { courseId, studentId: auth.userId },
  });
  if (!certificate) {
    const user = await db.user.findFirst({
      where: { id: auth.userId },
      select: { email: true },
    });
    const studentName = (user?.email ?? '').split('@')[0];
    const serial = `KURS-${courseId.slice(0, 4).toUpperCase()}-${Date.now()
      .toString(36)
      .toUpperCase()}`;
    certificate = await db.certificate.create({
      data: {
        tenantId: auth.tenantId!,
        courseId,
        studentId: auth.userId,
        studentName,
        courseTitle: course.title,
        serial,
      },
    });
  }

  const issuedOn = new Date(certificate.issuedAt).toLocaleDateString('he-IL');

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 print:bg-white print:p-0">
      <div className="w-full max-w-3xl">
        <div className="relative bg-card border-4 border-copper-500 rounded-xl2 shadow-lift overflow-hidden print:shadow-none print:border-copper-500">
          {/* inner accent frame */}
          <div className="absolute inset-3 border border-copper-300 rounded-xl pointer-events-none" />

          <div className="relative px-8 py-12 sm:px-16 sm:py-16 text-center">
            <div className="text-6xl mb-4" aria-hidden>
              🎓
            </div>

            <p className="kicker text-copper-600">{tenant.name}</p>

            <h1 className="font-display text-3xl sm:text-4xl font-black text-ink mt-4">
              {he.certificateHeading}
            </h1>

            <div className="w-16 h-1 bg-copper-500 rounded-full mx-auto my-6" />

            <p className="text-muted">{he.certificateAwardedTo}</p>
            <p
              className="font-display text-2xl sm:text-3xl font-bold text-copper-700 mt-2"
              dir="ltr"
            >
              {certificate.studentName}
            </p>

            <p className="text-muted mt-6">{he.certificateForCompleting}</p>
            <p className="font-display text-xl sm:text-2xl font-bold text-ink mt-2">
              {certificate.courseTitle}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 mt-10 text-sm text-muted">
              <p>
                {he.certificateIssuedOn}{' '}
                <span dir="ltr" className="tabular-nums text-ink font-semibold">
                  {issuedOn}
                </span>
              </p>
              <p>
                {he.certificateSerial}{' '}
                <span dir="ltr" className="font-mono text-ink font-semibold">
                  {certificate.serial}
                </span>
              </p>
            </div>

            <p className="text-xs text-muted mt-8">
              {he.certificateIssuedBy}{' '}
              <span className="font-semibold text-ink">{tenant.name}</span>
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-center print:hidden">
          <CertificatePrint />
        </div>
      </div>
    </div>
  );
}
