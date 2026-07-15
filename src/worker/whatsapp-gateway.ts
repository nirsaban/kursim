/**
 * WhatsApp Web (Baileys) gateway — runs inside the worker process.
 *
 * Hosts ONE platform WhatsApp connection used to send students their login
 * details after a purchase. Auth/session state persists in Redis so a restart
 * re-hydrates without re-scanning the QR. The app talks to this only through
 * Redis (see src/lib/whatsapp.ts). Adapted from the Kesher BaileysProvider.
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
import {
  WA_STATUS_KEY,
  WA_QR_KEY,
  WA_OUT_KEY,
  WA_CMD_KEY,
  type WaStatus,
} from '@/lib/whatsapp';

const requireCjs = createRequire(import.meta.url);
const { proto } = requireCjs('baileys') as {
  proto: { Message: { AppStateSyncKeyData: { fromObject(o: unknown): unknown } } };
};

const AUTH_KEY = 'wa:auth';
const RECONNECT_DELAY_MS = 3000;
const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL ?? 'silent' });

let sock: WASocket | null = null;
let status: WaStatus = 'pending';
let reconnecting = false;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setStatus(s: WaStatus, phone?: string): Promise<void> {
  status = s;
  await getRedis().set(WA_STATUS_KEY, JSON.stringify({ status: s, phone: phone ?? null, at: Date.now() }));
  if (s === 'connected') await getRedis().del(WA_QR_KEY);
}

interface AuthBlob {
  creds: AuthenticationCreds;
  keys: Record<string, unknown>;
}

async function loadAuth(): Promise<{
  creds: AuthenticationCreds;
  keys: SignalKeyStore;
  persist: () => Promise<void>;
}> {
  const raw = await getRedis().get(AUTH_KEY);
  const blob: AuthBlob = raw
    ? (JSON.parse(raw, BufferJSON.reviver) as AuthBlob)
    : { creds: initAuthCreds(), keys: {} };
  const creds = blob.creds;
  const keyMap = blob.keys;

  const persist = async () => {
    await getRedis().set(AUTH_KEY, JSON.stringify({ creds, keys: keyMap }, BufferJSON.replacer));
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

async function startSocket(): Promise<void> {
  const { creds, keys, persist } = await loadAuth();
  const { version } = await fetchLatestBaileysVersion().catch(() => ({
    version: undefined as [number, number, number] | undefined,
  }));

  sock = makeWASocket({
    auth: { creds, keys: makeCacheableSignalKeyStore(keys, logger) },
    logger,
    ...(version ? { version } : {}),
    browser: ['Kursim', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
  });

  void persist();
  sock.ev.on('creds.update', () => void persist());

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      const dataUrl = await QRCode.toDataURL(qr).catch(() => null);
      if (dataUrl) await getRedis().set(WA_QR_KEY, dataUrl);
      await setStatus('qr');
    }
    if (connection === 'open') {
      const phone = sock?.user?.id?.split(':')[0];
      await setStatus('connected', phone);
      console.log(`[wa] connected as ${phone ?? '?'}`);
    }
    if (connection === 'close') {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        sock = null;
        await getRedis().del(AUTH_KEY);
        await setStatus('logged_out');
        console.log('[wa] logged out');
      } else {
        scheduleReconnect();
      }
    }
  });
}

function scheduleReconnect(): void {
  if (reconnecting) return;
  reconnecting = true;
  void setStatus('disconnected');
  setTimeout(() => {
    reconnecting = false;
    sock = null;
    startSocket().catch(() => {
      /* a later command / restart retries */
    });
  }, RECONNECT_DELAY_MS);
}

async function sendText(to: string, text: string): Promise<void> {
  if (!sock || status !== 'connected') throw new Error('not_connected');
  const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

async function outboundLoop(): Promise<void> {
  const sub = createSubscriber();
  for (;;) {
    try {
      if (status !== 'connected') {
        await sleep(3000);
        continue;
      }
      const res = await sub.brpop(WA_OUT_KEY, 5);
      if (!res) continue;
      const { to, text } = JSON.parse(res[1]) as { to: string; text: string };
      await sendText(to, text).catch((e) => {
        console.error(`[wa] send failed: ${e instanceof Error ? e.message : e}`);
      });
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
      const cmd = res[1];
      if (cmd === 'connect') {
        if (status !== 'connected') {
          sock = null;
          await startSocket();
        }
      } else if (cmd === 'logout') {
        try {
          await sock?.logout();
        } catch {
          /* ignore */
        }
        sock = null;
        await getRedis().del(AUTH_KEY);
        await getRedis().del(WA_QR_KEY);
        await setStatus('logged_out');
      }
    } catch (e) {
      console.error(`[wa] command loop error: ${e instanceof Error ? e.message : e}`);
      await sleep(2000);
    }
  }
}

/** Start the gateway. Safe to call once at worker boot; never throws. */
export async function startWhatsappGateway(): Promise<void> {
  try {
    await setStatus('pending');
    await startSocket();
    void outboundLoop();
    void commandLoop();
    console.log('[wa] gateway started');
  } catch (e) {
    console.error(`[wa] gateway start failed: ${e instanceof Error ? e.message : e}`);
  }
}
