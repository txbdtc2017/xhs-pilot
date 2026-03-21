import Redis, { type RedisOptions } from 'ioredis';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

function createRedisConnectionOptions(url: string): RedisOptions {
  const parsedUrl = new URL(url);
  const options: RedisOptions = {
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : 6379,
    maxRetriesPerRequest: null,
  };

  if (parsedUrl.username) {
    options.username = decodeURIComponent(parsedUrl.username);
  }

  if (parsedUrl.password) {
    options.password = decodeURIComponent(parsedUrl.password);
  }

  if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
    options.db = Number(parsedUrl.pathname.slice(1));
  }

  if (parsedUrl.protocol === 'rediss:') {
    options.tls = {};
  }

  return options;
}

export const redisConnection = createRedisConnectionOptions(redisUrl);

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // BullMQ requires this
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});
