/**
 * The PLATFORM WhatsApp session — GeniriSchool's own number, paired by the
 * super-admin, used to talk to sales leads (greeting + scheduling bot).
 *
 * Rides the same Redis contract as tenant sessions (see lib/whatsapp.ts) under
 * the reserved session id 'platform'. Outbound jobs carry an empty messageId,
 * so the gateway skips the per-tenant WhatsappMessage logging for them.
 */
import { getRedis } from '@/lib/redis';
import { WA_OUT_KEY, normalizeIlPhone } from '@/lib/whatsapp';

export const PLATFORM_WA_ID = 'platform';

/** Queue a platform WhatsApp text. Returns false only for an unusable phone. */
export async function sendPlatformWhatsapp(to: string, text: string): Promise<boolean> {
  const phone = normalizeIlPhone(to);
  if (!phone) return false;
  await getRedis().lpush(
    WA_OUT_KEY,
    JSON.stringify({ tenantId: PLATFORM_WA_ID, messageId: '', to: phone, text }),
  );
  return true;
}
