import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { parseBody } from '@/lib/api';
import { getWhatsappState, getWhatsappQr, pushWhatsappCommand } from '@/lib/whatsapp';

/** This owner's WhatsApp connection status + current pairing QR. */
export async function GET() {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const [state, qr] = await Promise.all([
    getWhatsappState(auth.tenantId!),
    getWhatsappQr(auth.tenantId!),
  ]);
  return NextResponse.json({ ...state, qr: state.connected ? null : qr });
}

const cmdSchema = z.object({ action: z.enum(['connect', 'logout']) });

/** Trigger connect (start pairing) or logout (wipe session) for this owner. */
export async function POST(req: Request) {
  const auth = await requireAuth({ roles: ['OWNER'] });
  if (auth instanceof NextResponse) return auth;
  const parsed = await parseBody(req, cmdSchema);
  if ('error' in parsed) return parsed.error;
  await pushWhatsappCommand(auth.tenantId!, parsed.data.action);
  return NextResponse.json({ ok: true });
}
