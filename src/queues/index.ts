import { Queue } from 'bullmq';
import { redis } from '@/lib/redis';

// Note: BullMQ uses the Redis connection to create queues.
// We use the same redis instance for connection.

export const analyzeQueue = new Queue('sample:analyze', {
  connection: redis as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
  },
});

export const embedQueue = new Queue('sample:embed', {
  connection: redis as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
  },
});
