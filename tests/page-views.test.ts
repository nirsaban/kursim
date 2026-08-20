import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redisClient, course, tenant } = vi.hoisted(() => ({
  redisClient: new (require('ioredis-mock'))(),
  course: { update: vi.fn().mockResolvedValue({}) },
  tenant: { update: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@/lib/redis', () => ({
  getRedis: () => redisClient,
  createSubscriber: () => redisClient.duplicate(),
}));
vi.mock('@/lib/tenant/scoped-prisma', () => ({ forTenant: () => ({ course }) }));
vi.mock('@/lib/tenant/prisma', () => ({ prisma: { tenant } }));

import { isNewVisitor, trackCourseLandingView, trackLinktreeView } from '@/lib/analytics/page-views';

beforeEach(async () => {
  vi.clearAllMocks();
  await redisClient.flushall();
});

describe('isNewVisitor', () => {
  it('is true for a first-seen (ip, ua) pair, false on repeat', async () => {
    expect(await isNewVisitor('ns', 'id-1', '1.2.3.4', 'ua-a')).toBe(true);
    expect(await isNewVisitor('ns', 'id-1', '1.2.3.4', 'ua-a')).toBe(false);
  });

  it('dedupes per namespace+id — same visitor counts once per key', async () => {
    expect(await isNewVisitor('ns', 'id-1', '1.2.3.4', 'ua-a')).toBe(true);
    expect(await isNewVisitor('ns', 'id-2', '1.2.3.4', 'ua-a')).toBe(true);
  });

  it('treats different ip/ua as different visitors', async () => {
    expect(await isNewVisitor('ns', 'id-1', '1.2.3.4', 'ua-a')).toBe(true);
    expect(await isNewVisitor('ns', 'id-1', '5.6.7.8', 'ua-a')).toBe(true);
    expect(await isNewVisitor('ns', 'id-1', '1.2.3.4', 'ua-b')).toBe(true);
  });
});

describe('trackCourseLandingView', () => {
  it('increments Course.landingViews once for a new visitor', async () => {
    await trackCourseLandingView('tenant-a', 'course-1', '1.1.1.1', 'ua');
    expect(course.update).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      data: { landingViews: { increment: 1 } },
    });
  });

  it('does not increment on a repeat visit', async () => {
    await trackCourseLandingView('tenant-a', 'course-1', '1.1.1.1', 'ua');
    await trackCourseLandingView('tenant-a', 'course-1', '1.1.1.1', 'ua');
    expect(course.update).toHaveBeenCalledTimes(1);
  });
});

describe('trackLinktreeView', () => {
  it('increments Tenant.linktreeViews once for a new visitor', async () => {
    await trackLinktreeView('tenant-a', '2.2.2.2', 'ua');
    expect(tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-a' },
      data: { linktreeViews: { increment: 1 } },
    });
  });

  it('does not increment on a repeat visit', async () => {
    await trackLinktreeView('tenant-a', '2.2.2.2', 'ua');
    await trackLinktreeView('tenant-a', '2.2.2.2', 'ua');
    expect(tenant.update).toHaveBeenCalledTimes(1);
  });
});
