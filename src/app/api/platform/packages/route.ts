import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { platformPackagesSchema } from '@/lib/validation/schemas';
import { loadPackages, savePackagesOverride } from '@/lib/billing-server';

/** Super-admin: read/edit package prices + Grow payment links. */
export async function GET() {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  // The one server-callback URL to paste into every Grow package page.
  // Null until PLAN_WEBHOOK_SECRET is set on the server.
  const secret = process.env.PLAN_WEBHOOK_SECRET;
  const webhookUrl = secret
    ? `${process.env.APP_URL ?? ''}/api/pay/plan?k=${encodeURIComponent(secret)}`
    : null;
  return NextResponse.json({ packages: await loadPackages(), webhookUrl });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, platformPackagesSchema);
  if ('error' in parsed) return parsed.error;

  await savePackagesOverride(parsed.data);
  return NextResponse.json({ packages: await loadPackages() });
}
