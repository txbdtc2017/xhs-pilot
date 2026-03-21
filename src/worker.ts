import { Worker, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

logger.info('Starting BullMQ Workers...');

const analyzeWorker = new Worker('sample:analyze', async (job: Job) => {
  logger.info({ jobId: job.id, data: job.data }, 'Processing analyze job');
  // TODO: Implement Analysis Agent in Phase 2
  return { status: 'analyzed' };
}, {
  connection: redis as any,
  concurrency: Number(process.env.ANALYSIS_CONCURRENCY) || 2,
});

const embedWorker = new Worker('sample:embed', async (job: Job) => {
  logger.info({ jobId: job.id, data: job.data }, 'Processing embed job');
  // TODO: Implement Embedding in Phase 2
  return { status: 'embedded' };
}, {
  connection: redis as any,
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

process.on('SIGTERM', async () => {
  logger.info('Shutting down workers...');
  await analyzeWorker.close();
  await embedWorker.close();
  process.exit(0);
});
