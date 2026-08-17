/**
 * WhatsApp Web (Baileys) gateway — runs inside the worker process.
 *
 * Manages ONE WhatsApp connection PER TENANT (owners pair their own number).
 * Auth/session state persists in Redis per tenant so a restart re-hydrates
 * without re-scanning the QR. The app talks to this only through Redis (see
 * src/lib/whatsapp.ts). Adapted from the Kesher BaileysProvider.
 */
import { createRequire } from 'node:module';
import {
  BufferJSON,
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  makeCacheableSignalKeyStore,
  makeWASocket,
} from 'baileys';
import type { AuthenticationCreds, SignalDataTypeMap, SignalKeyStore, WASocket } from 'baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { getRedis, createSubscriber } from '@/lib/redis';
import { forTenant } from '@/lib/tenant/scoped-prisma';
import {
  WA_OUT_KEY,
  WA_CMD_KEY,
  waStatusKey,
  waQrKey,
  waAuthKey,
  type WaStatus,
} from '@/lib/whatsapp';
import { PLATFORM_WA_ID, sendPlatformWhatsapp } from '@/lib/platform-wa';
import { handleLeadMessage, formatSlot } from '@/lib/lead-bot';
import { handleMentorMessage } from '@/lib/mentor';
import { he } from '@/lib/he';

const requireCjs = createRequire(import.meta.url);
const { proto } = requireCjs('baileys') as {
  proto: { Message: { AppStateSyncKeyData: { fromObject(o: unknown): unknown } } };
};

const RECONNECT_DELAY_MS = 3000;
const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL ?? 'silent' });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Session {
  sock: WASocket;
  status: WaStatus;
  reconnecting: boolean;
}
const sessions = new Map<string, Session>();

function statusOf(tenantId: string): WaStatus {
  return sessions.get(tenantId)?.status ?? 'disconnected';
}

async function setStatus(tenantId: string, status: WaStatus, phone?: string): Promise<void> {
  const s = sessions.get(tenantId);
  if (s) s.status = status;
  await getRedis().set(waStatusKey(tenantId), JSON.stringify({ status, phone: phone ?? null, at: Date.now() }));
  if (status === 'connected') await getRedis().del(waQrKey(tenantId));
}

interface AuthBlob {
  creds: AuthenticationCreds;
  keys: Record<string, unknown>;
}

async function loadAuth(tenantId: string): Promise<{
  creds: AuthenticationCreds;
  keys: SignalKeyStore;
  persist: () => Promise<void>;
}> {
  const raw = await getRedis().get(waAuthKey(tenantId));
  const blob: AuthBlob = raw
    ? (JSON.parse(raw, BufferJSON.reviver) as AuthBlob)
    : { creds: initAuthCreds(), keys: {} };
  const creds = blob.creds;
  const keyMap = blob.keys;

  const persist = async () => {
    await getRedis().set(waAuthKey(tenantId), JSON.stringify({ creds, keys: keyMap }, BufferJSON.replacer));
  };

  const keys: SignalKeyStore = {
    get: async (type, ids) => {
      const out: Record<string, unknown> = {};
      for (const id of ids) {
        let value = keyMap[`${type}-${id}`];
        if (type === 'app-state-sync-key' && value) {
          value = proto.Message.AppStateSyncKeyData.fromObject(value);
        }
        out[id] = value;
      }
      return out as { [id: string]: SignalDataTypeMap[typeof type] };
    },
    set: async (data) => {
      for (const category in data) {
        const cat = data[category as keyof typeof data];
        for (const id in cat) {
          const value = cat[id];
          const key = `${category}-${id}`;
          if (value) keyMap[key] = value;
          else delete keyMap[key];
        }
      }
      await persist();
    },
  };

  return { creds, keys, persist };
}

async function startSocket(tenantId: string): Promise<void> {
  const existing = sessions.get(tenantId);
  if (existing && (existing.status === 'connected' || existing.status === 'qr')) return;

  const { creds, keys, persist } = await loadAuth(tenantId);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({
    version: undefined as [number, number, number] | undefined,
  }));

  const sock = makeWASocket({
    auth: { creds, keys: makeCacheableSignalKeyStore(keys, logger) },
    logger,
    ...(version ? { version } : {}),
    browser: ['Kursim', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
  });

  const session: Session = { sock, status: 'pending', reconnecting: false };
  sessions.set(tenantId, session);
  void persist();
  sock.ev.on('creds.update', () => void persist());

  // Every session is a two-way channel now: the platform number runs the
  // lead-scheduling bot; each school's number runs the course AI mentor
  // (which stays SILENT for anyone who isn't a recognized enrolled student —
  // the school's number is often the owner's personal one).
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      try {
        const jid = m.key.remoteJid ?? '';
        if (m.key.fromMe || !jid.endsWith('@s.whatsapp.net')) continue;
        const text = m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? '';
        if (!text.trim()) continue;
        const phone = jid.split('@')[0];

        if (tenantId === PLATFORM_WA_ID) {
          const reply = await handleLeadMessage(phone, text, m.pushName ?? undefined);
          await sock.sendMessage(jid, { text: reply.text });
          // A booked meeting is worth waking the admin for.
          if (reply.booked && process.env.PLATFORM_ADMIN_PHONE) {
            await sendPlatformWhatsapp(
              process.env.PLATFORM_ADMIN_PHONE,
              he.leadBotAdminAlert
                .replace('{name}', reply.booked.name)
                .replace('{phone}', reply.booked.phone)
                .replace('{slot}', formatSlot(reply.booked.at)),
            );
          }
        } else {
          const reply = await handleMentorMessage(tenantId, phone, text);
          if (reply) await sock.sendMessage(jid, { text: reply });
        }
      } catch (e) {
        console.error(`[wa:${tenantId}] inbound error: ${e instanceof Error ? e.message : e}`);
      }
    }
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      const dataUrl = await QRCode.toDataURL(qr).catch(() => null);
      if (dataUrl) await getRedis().set(waQrKey(tenantId), dataUrl);
      await setStatus(tenantId, 'qr');
    }
    if (connection === 'open') {
      const phone = sock.user?.id?.split(':')[0];
      await setStatus(tenantId, 'connected', phone);
      console.log(`[wa:${tenantId}] connected as ${phone ?? '?'}`);
    }
    if (connection === 'close') {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        sessions.delete(tenantId);
        await getRedis().del(waAuthKey(tenantId));
        await setStatus(tenantId, 'logged_out');
        console.log(`[wa:${tenantId}] logged out`);
      } else {
        scheduleReconnect(tenantId, session);
      }
    }
  });
}

function scheduleReconnect(tenantId: string, session: Session): void {
  if (session.reconnecting) return;
  session.reconnecting = true;
  void setStatus(tenantId, 'disconnected');
  setTimeout(() => {
    sessions.delete(tenantId);
    startSocket(tenantId).catch(() => {
      /* a later command / restart retries */
    });
  }, RECONNECT_DELAY_MS);
}

async function markMessage(tenantId: string, messageId: string, ok: boolean, error?: string): Promise<void> {
  if (!messageId) return;
  try {
    await forTenant(tenantId).whatsappMessage.update({
      where: { id: messageId },
      data: { status: ok ? 'sent' : 'failed', sentAt: ok ? new Date() : null, error: ok ? null : error ?? 'send_failed' },
    });
  } catch {
    /* log update is best-effort */
  }
}

async function outboundLoop(): Promise<void> {
  const sub = createSubscriber();
  for (;;) {
    try {
      const res = await sub.brpop(WA_OUT_KEY, 5);
      if (!res) continue;
      const job = JSON.parse(res[1]) as { tenantId: string; messageId: string; to: string; text: string };
      const session = sessions.get(job.tenantId);
      if (!session || session.status !== 'connected') {
        // tenant not ready — put it back and breathe so we don't hot-loop
        await getRedis().lpush(WA_OUT_KEY, res[1]);
        await sleep(3000);
        continue;
      }
      const jid = job.to.includes('@') ? job.to : `${job.to.replace(/\D/g, '')}@s.whatsapp.net`;
      try {
        await session.sock.sendMessage(jid, { text: job.text });
        await markMessage(job.tenantId, job.messageId, true);
      } catch (e) {
        await markMessage(job.tenantId, job.messageId, false, e instanceof Error ? e.message.slice(0, 200) : 'send_failed');
      }
    } catch (e) {
      console.error(`[wa] outbound loop error: ${e instanceof Error ? e.message : e}`);
      await sleep(2000);
    }
  }
}

async function commandLoop(): Promise<void> {
  const sub = createSubscriber();
  for (;;) {
    try {
      const res = await sub.brpop(WA_CMD_KEY, 10);
      if (!res) continue;
      const { tenantId, action } = JSON.parse(res[1]) as { tenantId: string; action: string };
      if (!tenantId) continue;
      if (action === 'connect') {
        if (statusOf(tenantId) !== 'connected') {
          sessions.delete(tenantId);
          await startSocket(tenantId);
        }
      } else if (action === 'logout') {
        const s = sessions.get(tenantId);
        try {
          await s?.sock.logout();
        } catch {
          /* ignore */
        }
        sessions.delete(tenantId);
        await getRedis().del(waAuthKey(tenantId));
        await getRedis().del(waQrKey(tenantId));
        await setStatus(tenantId, 'logged_out');
      }
    } catch (e) {
      console.error(`[wa] command loop error: ${e instanceof Error ? e.message : e}`);
      await sleep(2000);
    }
  }
}

/** Re-hydrate every tenant that already has a stored session. */
async function reconnectExisting(): Promise<void> {
  const r = getRedis();
  let cursor = '0';
  const prefix = waAuthKey('');
  do {
    const [next, keys] = await r.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
    cursor = next;
    for (const key of keys) {
      const tenantId = key.slice(prefix.length);
      if (tenantId) await startSocket(tenantId).catch(() => {});
    }
  } while (cursor !== '0');
}

/** Start the gateway. Safe to call once at worker boot; never throws. */
export async function startWhatsappGateway(): Promise<void> {
  try {
    void outboundLoop();
    void commandLoop();
    await reconnectExisting();
    console.log('[wa] gateway started (per-tenant)');
  } catch (e) {
    console.error(`[wa] gateway start failed: ${e instanceof Error ? e.message : e}`);
  }
}
