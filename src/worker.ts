import { Worker } from 'bullmq';
import { pathToFileURL } from 'node:url';
import { embedMany } from 'ai';
import { analyzeText, analyzeImage } from './agents/analysis';
import { query, queryOne } from './lib/db';
import { llmEmbedding } from './lib/llm';
import { logger } from './lib/logger';
import { redisConnection } from './lib/redis';
import { DEFAULT_EMBEDDING_MODEL, resolveSearchModeStatus } from './lib/search-mode';
import { storage } from './lib/storage';
import { embedQueue } from './queues';
import {
  processAnalyzeJob,
  processEmbedJob,
  type AnalyzeJobDependencies,
  type AnalyzeJobLike,
  type EmbedJobDependencies,
} from './worker-jobs';

function createAnalyzeJobDependencies(): AnalyzeJobDependencies {
  return {
    query,
    queryOne,
    analyzeText,
    analyzeImage,
    storage,
    embedQueue,
    logger,
  };
}

function createEmbedJobDependencies(): EmbedJobDependencies {
  return {
    query,
    queryOne,
    createEmbedding: async (textToEmbed: string) => {
      const searchModeStatus = resolveSearchModeStatus();
      if (searchModeStatus.searchMode !== 'hybrid') {
        throw new Error(
          searchModeStatus.searchModeReason ?? 'Embedding provider is not available for backfill.',
        );
      }

      const { embeddings } = await embedMany({
        model: llmEmbedding.textEmbeddingModel(process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL),
        values: [textToEmbed],
        maxRetries: 3,
      });

      return embeddings[0];
    },
    logger,
  };
}

export let analyzeWorker: Worker<{ sampleId: string }> | undefined;
export let embedWorker: Worker<{ sampleId: string }> | undefined;

export function startWorkers(): {
  analyzeWorker: Worker<{ sampleId: string }>;
  embedWorker: Worker<{ sampleId: string }>;
} {
  if (analyzeWorker && embedWorker) {
    return { analyzeWorker, embedWorker };
  }

  analyzeWorker = new Worker<{ sampleId: string }>(
    'sample-analyze',
    async (job) => {
      try {
        await processAnalyzeJob(job as AnalyzeJobLike, createAnalyzeJobDependencies());
      } catch (error) {
        logger.error({ error, job: job.id }, 'Analyze job failed');
        await query('UPDATE samples SET status = $1 WHERE id = $2', ['failed', job.data.sampleId]);
        throw error;
      }
    },
    { connection: redisConnection },
  );

  embedWorker = new Worker<{ sampleId: string }>(
    'sample-embed',
    async (job) => {
      try {
        await processEmbedJob(job as AnalyzeJobLike, createEmbedJobDependencies());
      } catch (error) {
        logger.error({ error, job: job.id }, 'Embed job failed');
        await query('UPDATE samples SET status = $1 WHERE id = $2', ['failed', job.data.sampleId]);
        throw error;
      }
    },
    { connection: redisConnection },
  );

  logger.info('Workers started');

  return { analyzeWorker, embedWorker };
}

function isExecutedDirectly(): boolean {
  const entryPath = process.argv[1];
  return typeof entryPath === 'string' && import.meta.url === pathToFileURL(entryPath).href;
}

if (isExecutedDirectly()) {
  startWorkers();
}
