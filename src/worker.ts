import { Worker, Job } from 'bullmq';
import { redis, redisConnection } from '@/lib/redis';
import { logger } from '@/lib/logger';

logger.info('Starting BullMQ Workers...');

const analyzeWorker = new Worker('sample-analyze', async (job: Job) => {
  logger.info({ jobId: job.id, data: job.data }, 'Processing analyze job');
  // TODO: Implement Analysis Agent in Phase 2
  return { status: 'analyzed' };
}, {
  connection: redisConnection,
  concurrency: Number(process.env.ANALYSIS_CONCURRENCY) || 2,
});

const embedWorker = new Worker('sample-embed', async (job: Job) => {
  logger.info({ jobId: job.id, data: job.data }, 'Processing embed job');
  // TODO: Implement Embedding in Phase 2
  return { status: 'embedded' };
}, {
  connection: redisConnection,
});

analyzeWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Analyze job completed');
});

analyzeWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Analyze job failed');
});

embedWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Embed job completed');
});

embedWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Embed job failed');
});

logger.info('Workers are ready and listening for jobs.');

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down workers...');
  await analyzeWorker.close();
  await embedWorker.close();
  await redis.quit();
  process.exit(0);
}

process.on('SIGTERM', async () => {
  await shutdown('SIGTERM');
});

process.on('SIGINT', async () => {
  await shutdown('SIGINT');
});
