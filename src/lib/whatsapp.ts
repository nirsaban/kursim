/**
 * App-side WhatsApp interface. The actual WhatsApp Web (Baileys) socket lives in
 * the worker process (src/worker/whatsapp-gateway.ts); the app only talks to it
 * through Redis — so baileys is never bundled into the Next app.
 *
 * Redis keys (shared with the worker gateway):
 *   wa:status  JSON { status, phone, at }   — connection state
 *   wa:qr      data-URL PNG                  — current pairing QR (when status=qr)
 *   wa:out     LIST of { to, text } JSON     — outbound queue (worker sends)
 *   wa:cmd     LIST of 'connect' | 'logout'  — control commands
 */
import { getRedis } from '@/lib/redis';

export const WA_STATUS_KEY = 'wa:status';
export const WA_QR_KEY = 'wa:qr';
export const WA_OUT_KEY = 'wa:out';
export const WA_CMD_KEY = 'wa:cmd';

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

export async function getWhatsappState(): Promise<WaState> {
  try {
    const raw = await getRedis().get(WA_STATUS_KEY);
    if (!raw) return { status: 'disconnected', phone: null, connected: false };
    const j = JSON.parse(raw) as { status?: WaStatus; phone?: string | null };
    const status = (j.status ?? 'unknown') as WaStatus;
    return { status, phone: j.phone ?? null, connected: status === 'connected' };
  } catch {
    return { status: 'unknown', phone: null, connected: false };
  }
}

export async function getWhatsappQr(): Promise<string | null> {
  try {
    return await getRedis().get(WA_QR_KEY);
  } catch {
    return null;
  }
}

export async function pushWhatsappCommand(cmd: 'connect' | 'logout'): Promise<void> {
  await getRedis().lpush(WA_CMD_KEY, cmd);
}

export interface WhatsappResult {
  ok: boolean;
  error?: string;
}

/**
 * Queue a WhatsApp text for delivery. The worker sends it as soon as the
 * platform number is connected — so a message queued while disconnected is not
 * lost, it just waits. `ok` reflects whether we're connected right now.
 */
export async function sendWhatsappText(to: string, text: string): Promise<WhatsappResult> {
  const phone = normalizeIlPhone(to);
  if (!phone) return { ok: false, error: 'bad_phone' };
  try {
    await getRedis().lpush(WA_OUT_KEY, JSON.stringify({ to: phone, text }));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'enqueue_failed' };
  }
  const st = await getWhatsappState();
  return st.connected ? { ok: true } : { ok: false, error: `wa_${st.status}` };
}
