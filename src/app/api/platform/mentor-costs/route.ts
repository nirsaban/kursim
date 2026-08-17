import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { mentorSettingsSchema } from '@/lib/validation/schemas';
import { asSuperAdmin } from '@/lib/tenant/scoped-prisma';
import { prisma } from '@/lib/tenant/prisma';
import { currentMonth, usageCents } from '@/lib/mentor';

/** Super-admin: this month's mentor cost per school, budgets, and the top-up link. */
export async function GET() {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;

  const month = currentMonth();
  const db = asSuperAdmin();
  const [usage, tenants, setting] = await Promise.all([
    db.mentorUsage.findMany({ where: { month } }),
    db.tenant.findMany({
      select: { id: true, name: true, slug: true, plan: true, mentorBudgetCents: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.platformSetting.findUnique({ where: { key: 'mentor' } }),
  ]);

  const usageByTenant = new Map(usage.map((u) => [u.tenantId, u]));
  const rows = tenants.map((t) => {
    const u = usageByTenant.get(t.id);
    const cents = u ? usageCents(u.inputTokens, u.outputTokens) : 0;
    return {
      tenantId: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      budgetCents: t.mentorBudgetCents,
      messages: u?.messages ?? 0,
      inputTokens: u?.inputTokens ?? 0,
      outputTokens: u?.outputTokens ?? 0,
      costCents: Math.round(cents * 100) / 100,
      exhausted: cents >= t.mentorBudgetCents,
    };
  });

  return NextResponse.json({
    month,
    rows,
    totals: {
      costCents: Math.round(rows.reduce((s, r) => s + r.costCents, 0) * 100) / 100,
      messages: rows.reduce((s, r) => s + r.messages, 0),
      overBudget: rows.filter((r) => r.exhausted && r.messages > 0).length,
    },
    topupLink: ((setting?.value ?? {}) as { topupLink?: string }).topupLink ?? '',
  });
}

/** Saves the top-up Grow link offered to owners when their budget runs out. */
export async function PATCH(req: Request) {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, mentorSettingsSchema);
  if ('error' in parsed) return parsed.error;

  await prisma.platformSetting.upsert({
    where: { key: 'mentor' },
    update: { value: parsed.data },
    create: { key: 'mentor', value: parsed.data },
  });
  return NextResponse.json({ ok: true });
}
