import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { listLiveSessions } from '@/lib/session-registry/registry';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import TiltCard from '@/components/fx/TiltCard';
import { Card, CardHeader } from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import { he } from '@/lib/he';

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getAuth();
  if (!auth) redirect(`/t/${slug}/login`);

  const db = forTenant(auth.tenantId!);
  const [studentCount, courseCount, publishedCount, landingCount, users] = await Promise.all([
    db.user.count({ where: { role: 'STUDENT' } }),
    db.course.count(),
    db.course.count({ where: { status: 'PUBLISHED' } }),
    db.course.count({ where: { landingPublished: true } }),
    db.user.findMany({
      where: { role: { in: ['STUDENT', 'INSTRUCTOR'] } },
      select: { id: true, email: true },
    }),
  ]);

  const liveSessions = (
    await Promise.all(
      users.map(async (u) =>
        (await listLiveSessions(u.id)).map((s) => ({ ...s, email: u.email })),
      ),
    )
  ).flat();
  liveSessions.sort((a, b) => b.lastSeenAt - a.lastSeenAt);

  return (
    <div>
      <PageHeader
        kicker={he.dashboard}
        title={he.adminOverviewTitle}
        actions={
          <Link
            href={`/t/${slug}/admin/courses/new`}
            className="inline-flex items-center bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold rounded-xl px-4 py-2 transition-colors"
          >
            + {he.newCourseWizard}
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-8">
        <div className="animate-rise rise-1">
          <TiltCard maxTilt={5} className="rounded-xl2 h-full">
            <StatCard
              label={he.students}
              value={studentCount}
              href={`/t/${slug}/admin/students`}
            />
          </TiltCard>
        </div>
        <div className="animate-rise rise-2">
          <TiltCard maxTilt={5} className="rounded-xl2 h-full">
            <StatCard
              label={he.courses}
              value={courseCount}
              sub={`${publishedCount} ${he.published}`}
              href={`/t/${slug}/admin/courses`}
            />
          </TiltCard>
        </div>
        <div className="animate-rise rise-3">
          <TiltCard maxTilt={5} className="rounded-xl2 h-full">
            <StatCard
              label={he.sessions}
              value={liveSessions.length}
              accent
              href={`/t/${slug}/admin/sessions`}
            />
          </TiltCard>
        </div>
        <div className="animate-rise rise-4">
          <TiltCard maxTilt={5} className="rounded-xl2 h-full">
            <StatCard label={he.landingPage} value={landingCount} sub={he.landingPublished} />
          </TiltCard>
        </div>
      </div>

      <Card className="animate-rise rise-5">
        <CardHeader
          title={he.whoIsWatching}
          actions={
            liveSessions.length > 0 ? (
              <Badge tone="ok" dot>
                {liveSessions.length} {he.sessions}
              </Badge>
            ) : undefined
          }
        />
        {liveSessions.length === 0 ? (
          <EmptyState icon="🌙" title={he.noLiveSessions} hint={he.adminSessionsEmptyHint} />
        ) : (
          <ul className="divide-y divide-line/70">
            {liveSessions.slice(0, 8).map((s) => (
              <li key={s.sid} className="px-5 py-3 flex items-center gap-4 text-sm">
                <span className="w-8 h-8 rounded-full bg-brand-100 text-brand-800 font-display font-bold text-xs flex items-center justify-center shrink-0">
                  <span dir="ltr">{s.email[0]?.toUpperCase()}</span>
                </span>
                <span className="flex-1 truncate" dir="ltr">
                  {s.email}
                </span>
                <span className="text-muted text-xs hidden sm:block">{s.deviceLabel}</span>
                <span className="text-muted text-xs tabular-nums" dir="ltr">
                  {new Date(s.lastSeenAt).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
