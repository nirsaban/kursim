import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { calcomConfigSchema } from '@/lib/validation/schemas';
import { loadCalcomConfig, saveCalcomConfig } from '@/lib/calcom';

/** Super-admin: the Cal.com booking URL + webhook secret the lead bot uses. */
export async function GET() {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ calcom: await loadCalcomConfig() });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, calcomConfigSchema);
  if ('error' in parsed) return parsed.error;

  await saveCalcomConfig(parsed.data);
  return NextResponse.json({ calcom: parsed.data });
}
