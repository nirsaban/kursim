import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { getWhatsappState, getWhatsappQr, pushWhatsappCommand } from '@/lib/whatsapp';

/** Platform WhatsApp status + current pairing QR (super-admin only). */
export async function GET() {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  const [state, qr] = await Promise.all([getWhatsappState(), getWhatsappQr()]);
  return NextResponse.json({ ...state, qr: state.connected ? null : qr });
}

const cmdSchema = z.object({ action: z.enum(['connect', 'logout']) });

/** Trigger connect (start pairing) or logout (wipe session). */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['SUPER_ADMIN'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, cmdSchema);
  if ('error' in parsed) return parsed.error;
  await pushWhatsappCommand(parsed.data.action);
  return NextResponse.json({ ok: true });
}
