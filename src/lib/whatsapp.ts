/**
 * App-side WhatsApp interface. The actual WhatsApp Web (Baileys) sockets live in
 * the worker process (src/worker/whatsapp-gateway.ts) — one connection PER TENANT.
 * The app talks to the worker only through Redis, so baileys is never bundled
 * into the Next app.
 *
 * Redis keys:
 *   wa:status:{tenantId}  JSON { status, phone, at }     — per-tenant connection state
 *   wa:qr:{tenantId}      data-URL PNG                    — per-tenant pairing QR
 *   wa:auth:{tenantId}    JSON                            — per-tenant session (worker only)
 *   wa:out               LIST of { tenantId, messageId, to, text }  — outbound queue
 *   wa:cmd               LIST of { tenantId, action }     — control commands
 */
import { getRedis } from '@/lib/redis';
import { forTenant } from '@/lib/tenant/scoped-prisma';

export const WA_OUT_KEY = 'wa:out';
export const WA_CMD_KEY = 'wa:cmd';
export const waStatusKey = (tenantId: string) => `wa:status:${tenantId}`;
export const waQrKey = (tenantId: string) => `wa:qr:${tenantId}`;
export const waAuthKey = (tenantId: string) => `wa:auth:${tenantId}`;

export type WaStatus = 'pending' | 'qr' | 'connected' | 'disconnected' | 'logged_out' | 'unknown';

export interface WaState {
  status: WaStatus;
  phone: string | null;
  connected: boolean;
}

/** Normalise an Israeli phone to E.164 digits (972XXXXXXXXX). Null if unusable. */
export function normalizeIlPhone(raw: string): string | null {
  let d = (raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('972')) {
    // ok
  } else if (d.startsWith('0')) {
    d = '972' + d.slice(1);
  } else if (d.length === 9) {
    d = '972' + d;
  } else {
    return null;
  }
  return d.length >= 11 && d.length <= 15 ? d : null;
}

export async function getWhatsappState(tenantId: string): Promise<WaState> {
  try {
    const raw = await getRedis().get(waStatusKey(tenantId));
    if (!raw) return { status: 'disconnected', phone: null, connected: false };
    const j = JSON.parse(raw) as { status?: WaStatus; phone?: string | null };
    const status = (j.status ?? 'unknown') as WaStatus;
    return { status, phone: j.phone ?? null, connected: status === 'connected' };
  } catch {
    return { status: 'unknown', phone: null, connected: false };
  }
}

export async function getWhatsappQr(tenantId: string): Promise<string | null> {
  try {
    return await getRedis().get(waQrKey(tenantId));
  } catch {
    return null;
  }
}

export async function pushWhatsappCommand(tenantId: string, action: 'connect' | 'logout'): Promise<void> {
  await getRedis().lpush(WA_CMD_KEY, JSON.stringify({ tenantId, action }));
}

export interface WhatsappResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Queue a WhatsApp text for one tenant and log it. The tenant's worker socket
 * sends it once connected, so a message queued while disconnected still goes out
 * later. `ok` reflects whether that tenant is connected right now.
 */
export async function sendWhatsappText(
  tenantId: string,
  to: string,
  text: string,
  kind = 'login',
): Promise<WhatsappResult> {
  const db = forTenant(tenantId);
  const phone = normalizeIlPhone(to);
  if (!phone) {
    await db.whatsappMessage.create({
      data: { tenantId, toPhone: to, body: text, kind, status: 'failed', error: 'bad_phone' },
    });
    return { ok: false, error: 'bad_phone' };
  }

  const msg = await db.whatsappMessage.create({
    data: { tenantId, toPhone: phone, body: text, kind, status: 'queued' },
    select: { id: true },
  });

  try {
    await getRedis().lpush(WA_OUT_KEY, JSON.stringify({ tenantId, messageId: msg.id, to: phone, text }));
  } catch (e) {
    await db.whatsappMessage.update({
      where: { id: msg.id },
      data: { status: 'failed', error: e instanceof Error ? e.message : 'enqueue_failed' },
    });
    return { ok: false, error: 'enqueue_failed', messageId: msg.id };
  }

  const st = await getWhatsappState(tenantId);
  return { ok: st.connected, error: st.connected ? undefined : `wa_${st.status}`, messageId: msg.id };
}
