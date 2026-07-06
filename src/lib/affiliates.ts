import { createHash, randomBytes } from 'crypto';
import { getRedis } from '@/lib/redis';
import { forTenant } from '@/lib/tenant/scoped-prisma';

/** Unique visitors needed to earn one coin (tunable via env). */
export function visitsPerCoin(): number {
  const n = Number(process.env.AFFILIATE_VISITS_PER_COIN ?? 100);
  return Number.isFinite(n) && n > 0 ? n : 100;
}

export function coinsFor(visits: number): number {
  return Math.floor(visits / visitsPerCoin());
}

/** Short, URL-safe share code. */
export function generateAffiliateCode(): string {
  return randomBytes(6).toString('base64url');
}

/**
 * Count a landing-page visit that arrived via ?ref={code}. A visitor is
 * deduplicated by a hash of IP + user-agent kept in a Redis set per link,
 * so refreshes and repeat visits don't inflate the counter.
 */
export async function trackAffiliateVisit(
  tenantId: string,
  courseId: string,
  code: string,
  ip: string,
  ua: string,
): Promise<void> {
  const db = forTenant(tenantId);
  const link = await db.affiliateLink.findFirst({ where: { code, courseId } });
  if (!link) return;

  const visitorHash = createHash('sha256').update(`${ip}|${ua}`).digest('hex');
  const key = `aff:visitors:${link.id}`;
  const isNew = await getRedis().sadd(key, visitorHash);
  if (isNew === 1) {
    await db.affiliateLink.update({
      where: { id: link.id },
      data: { visits: { increment: 1 } },
    });
  }
}
