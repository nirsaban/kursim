import { notFound, redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/guards';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import { normalizePlan, PLAN_STUDENT_CAP, type Plan } from '@/lib/billing';
import { loadPackages } from '@/lib/billing-server';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Icon from '@/components/ui/Icon';
import { Card, CardBody } from '@/components/ui/Card';
import { he } from '@/lib/he';
import { cn } from '@/lib/cn';

const PLAN_NAME: Record<Plan, string> = {
  FREE: he.planFree,
  STARTER: he.planStarter,
  GROWTH: he.planGrowth,
  UNLIMITED: he.planUnlimited,
};

const PLAN_DESC: Record<Plan, string> = {
  FREE: he.planFreeDesc,
  STARTER: he.planStarterDesc,
  GROWTH: he.planGrowthDesc,
  UNLIMITED: he.planUnlimitedDesc,
};

export default async function AdminPlanPage({
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
  const plan = normalizePlan(tenant.plan);
  const [studentCount, packages] = await Promise.all([
    forTenant(tenant.id).user.count({ where: { role: 'STUDENT' } }),
    loadPackages(),
  ]);
  const cap = PLAN_STUDENT_CAP[plan];

  return (
    <div>
      <PageHeader kicker={he.admin} title={he.planPageTitle} subtitle={he.planPageSubtitle} />

      {/* Current plan */}
      <Card className="mb-8">
        <CardBody className="flex flex-wrap items-center gap-4">
          <span className="w-12 h-12 rounded-xl bg-brand-50 border border-line grid place-items-center text-ink">
            <Icon name="award" size={20} />
          </span>
          <div className="flex-1 min-w-48">
            <p className="kicker">{he.planCurrentLabel}</p>
            <p className="font-display font-bold text-2xl mt-0.5">{PLAN_NAME[plan]}</p>
          </div>
          <div className="text-end">
            <p className="kicker">{he.planStudentsUsed}</p>
            <p className="font-display font-bold text-xl tabular-nums mt-0.5">
              {studentCount}
              {Number.isFinite(cap) && <span className="text-muted text-base"> / {cap}</span>}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* The three packages */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {packages.map((p) => {
          const isCurrent = p.plan === plan;
          const popular = p.plan === 'GROWTH';
          return (
            <div
              key={p.plan}
              className={cn(
                'bg-card border rounded-xl2 shadow-card p-6 flex flex-col',
                popular ? 'border-copper-300 shadow-lift' : 'border-line',
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <h2 className="font-display font-bold text-lg">{PLAN_NAME[p.plan]}</h2>
                {isCurrent ? (
                  <Badge tone="ok">{he.planCurrentBadge}</Badge>
                ) : (
                  popular && <Badge tone="copper">{he.lpPricingPopular}</Badge>
                )}
              </div>
              <p className="text-sm text-muted leading-relaxed flex-1">{PLAN_DESC[p.plan]}</p>
              <p className="mt-5">
                <span className="font-display font-bold text-3xl">{p.priceMonthly}</span>
                <span className="text-sm text-muted ms-1.5">{he.planPerMonth}</span>
              </p>
              <p className="text-sm text-muted mt-1">
                {Number.isFinite(p.cap)
                  ? `${he.planUpTo} ${p.cap} ${he.planStudentsCap}`
                  : he.planNoCap}
              </p>
              {!isCurrent &&
                (p.growLink ? (
                  <a
                    href={p.growLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'mt-5 inline-flex items-center justify-center font-bold rounded-xl min-h-[48px] transition-[background-color,transform] duration-150 active:scale-[0.98]',
                      popular
                        ? 'bg-copper-500 hover:bg-copper-600 text-card'
                        : 'bg-ink hover:bg-ink-surface text-card',
                    )}
                  >
                    {he.planChoose}
                  </a>
                ) : (
                  <span className="mt-5 inline-flex items-center justify-center font-semibold rounded-xl min-h-[48px] border-[1.5px] border-line text-muted">
                    {he.planContactToBuy}
                  </span>
                ))}
              {isCurrent && (
                <span className="mt-5 inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl min-h-[48px] border-[1.5px] border-ok/40 text-ok">
                  <Icon name="check" size={15} />
                  {he.planCurrentBadge}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-sm text-muted mt-6 leading-relaxed">{he.planActivationNote}</p>
    </div>
  );
}
