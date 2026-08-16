import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api';
import { asSuperAdmin, forTenant } from '@/lib/tenant/scoped-prisma';
import { runInactivitySweep } from '@/lib/automations';

/**
 * Periodic inactivity sweep across all tenants. Not a user endpoint — call it
 * from cron (curl) with the shared secret:
 *
 *   curl -X POST "https://host/api/cron/automations?secret=$CRON_SECRET"
 *
 * Idempotent per quiet spell: a student is nudged once per automation until
 * they learn again, so running this hourly or daily sends the same mail count.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return apiError(503, 'cron_not_configured');
  const presented = new URL(req.url).searchParams.get('secret');
  if (presented !== secret) return apiError(401, 'unauthorized');

  // Which tenants even have an active inactivity automation — super client,
  // since this runs for the whole platform.
  const tenants = await asSuperAdmin().emailAutomation.findMany({
    where: { trigger: 'INACTIVITY', active: true },
    select: { tenantId: true },
    distinct: ['tenantId'],
  });

  let sent = 0;
  for (const { tenantId } of tenants) {
    sent += await runInactivitySweep(forTenant(tenantId), tenantId);
  }
  return NextResponse.json({ tenants: tenants.length, sent });
}
