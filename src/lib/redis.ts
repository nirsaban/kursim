import Redis from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var __kursimRedis: Redis | undefined;
}

function redisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379';
}

export function getRedis(): Redis {
  if (!globalThis.__kursimRedis) {
    globalThis.__kursimRedis = new Redis(redisUrl(), {
      maxRetriesPerRequest: 2,
    });
  }
  return globalThis.__kursimRedis;
}

// Pub/sub subscribers need a dedicated connection (a subscribed ioredis
// connection cannot issue regular commands).
export function createSubscriber(): Redis {
  return new Redis(redisUrl(), { maxRetriesPerRequest: 2 });
}
