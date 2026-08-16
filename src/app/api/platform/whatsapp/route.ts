import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { z } from 'zod';
import { getWhatsappQr, getWhatsappState, pushWhatsappCommand } from '@/lib/whatsapp';
import { PLATFORM_WA_ID } from '@/lib/platform-wa';

/** Super-admin: the platform WhatsApp session (lead bot) — status, QR, connect/logout. */
export async function GET() {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  const [state, qr] = await Promise.all([
    getWhatsappState(PLATFORM_WA_ID),
    getWhatsappQr(PLATFORM_WA_ID),
  ]);
  return NextResponse.json({ state, qr });
}

const actionSchema = z.object({ action: z.enum(['connect', 'logout']) });

export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, actionSchema);
  if ('error' in parsed) return parsed.error;
  await pushWhatsappCommand(PLATFORM_WA_ID, parsed.data.action);
  return NextResponse.json({ ok: true });
}
