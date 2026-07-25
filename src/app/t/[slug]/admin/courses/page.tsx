import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { parseMarketing } from '@/lib/validation/marketing';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { he } from '@/lib/he';

export default async function AdminCoursesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  const courses = await forTenant(auth.tenantId!).course.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { modules: true, enrollments: true } } },
  });

  const newCourseBtn = (
    <Link
      href={`/t/${slug}/admin/courses/new`}
      className="inline-flex items-center bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold rounded-xl px-4 py-2 transition-colors"
    >
      + {he.newCourseWizard}
    </Link>
  );

  return (
    <div>
      <PageHeader kicker={he.admin} title={he.courses} actions={newCourseBtn} />

      {courses.length === 0 ? (
        <EmptyState
          icon="🎬"
          title={he.noCourses}
          hint={he.wizardIntro}
          action={newCourseBtn}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {courses.map((course) => {
            const emoji = parseMarketing(course.marketing).emoji;
            return (
              <Link
                key={course.id}
                href={`/t/${slug}/admin/courses/${course.id}`}
                className="group bg-card border border-line rounded-xl2 shadow-card hover:shadow-lift transition-shadow p-5"
              >
                <div className="flex items-start gap-4">
                  <span className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-2xl shrink-0">
                    {emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-display font-bold truncate group-hover:text-brand-700 transition-colors">
                        {course.title}
                      </h2>
                      <Badge tone={course.status === 'PUBLISHED' ? 'ok' : 'neutral'}>
                        {course.status === 'PUBLISHED' ? he.published : he.draft}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted mt-1">
                      {course._count.modules} {he.modules} · {course._count.enrollments}{' '}
                      {he.enrollments}
                    </p>
                    <div className="mt-3">
                      {course.landingPublished ? (
                        <Badge tone="copper" dot>
                          {he.landingPublished}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">
                          {he.landingPage}: {he.landingDraftBadge}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
