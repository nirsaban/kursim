import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import { Table, TableWrap, Td, Th } from '@/components/ui/Table';
import { cn } from '@/lib/cn';
import { he } from '@/lib/he';

const MEDALS = ['🥇', '🥈', '🥉'];

export default async function LeaderboardPage({
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

  const grouped = await db.progress.groupBy({
    by: ['studentId'],
    where: { completedAt: { not: null } },
    _count: { _all: true },
  });

  const ranked = grouped
    .map((g) => ({ studentId: g.studentId, lessons: g._count._all }))
    .filter((r) => r.lessons >= 1)
    .sort((a, b) => b.lessons - a.lessons)
    .slice(0, 20);

  const students =
    ranked.length > 0
      ? await db.user.findMany({
          where: { id: { in: ranked.map((r) => r.studentId) }, role: 'STUDENT' },
          select: { id: true, email: true, name: true },
        })
      : [];
  const studentById = new Map(students.map((s) => [s.id, s]));

  // Keep only actual students (grouping is progress-based; filter non-students out).
  const rows = ranked.filter((r) => studentById.has(r.studentId));

  return (
    <div>
      <PageHeader
        kicker={he.myCourses}
        title={he.leaderboard}
        subtitle={he.leaderboardSubtitle}
      />

      {rows.length === 0 ? (
        <EmptyState icon="🏆" title={he.leaderboardEmpty} />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th className="w-16">{he.rankLabel}</Th>
                <Th>{he.learnerLabel}</Th>
                <Th className="text-end">{he.leaderLessonsLabel}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isMe = r.studentId === auth.userId;
                const student = studentById.get(r.studentId);
                const name =
                  student?.name?.trim() ||
                  (isMe ? (student?.email ?? '').split('@')[0] : he.anonymousLearner);
                return (
                  <tr
                    key={r.studentId}
                    className={cn(
                      'transition-colors',
                      isMe ? 'bg-copper-100/60' : 'hover:bg-paper/60',
                    )}
                  >
                    <Td className="tabular-nums font-display font-bold text-lg">
                      {i < 3 ? (
                        <span aria-hidden>{MEDALS[i]}</span>
                      ) : (
                        <span className="text-muted">{i + 1}</span>
                      )}
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-2">
                        <span className="font-semibold" dir="ltr">
                          {name}
                        </span>
                        {isMe && <Badge tone="copper">{he.youLabel}</Badge>}
                      </span>
                    </Td>
                    <Td className="text-end tabular-nums font-semibold">{r.lessons}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}
