import { Queue } from 'bullmq';
import { redisConnection } from '@/lib/redis';

export const analyzeQueue = new Queue('sample-analyze', {
  connection: redisConnection,
});

export const embedQueue = new Queue('sample-embed', {
  connection: redisConnection,
});
