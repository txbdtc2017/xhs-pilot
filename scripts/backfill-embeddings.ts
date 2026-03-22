import { pool, query } from '@/lib/db';
import { backfillMissingEmbeddings } from '@/lib/embedding-backfill';
import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';
import { resolveSearchModeStatus } from '@/lib/search-mode';
import { embedQueue } from '@/queues';

async function main(): Promise<void> {
  const result = await backfillMissingEmbeddings({
    query,
    enqueueEmbeddingJob: async (sampleId) => embedQueue.add('embed', { sampleId }),
    getSearchModeStatus: () => resolveSearchModeStatus(),
  });

  logger.info({ queued: result.queued }, 'Queued embedding backfill jobs');
}

main()
  .catch((error) => {
    logger.error({ error }, 'Embedding backfill failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await embedQueue.close();
    await pool.end();

    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  });
