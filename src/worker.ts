import { Worker } from 'bullmq';
import { pathToFileURL } from 'node:url';
import { embedMany } from 'ai';
import { analyzeText, analyzeImage } from './agents/analysis';
import { generatePlannedImages } from './agents/image-generation';
import { imageGenerationRepository } from './app/api/image-generation/repository';
import { query, queryOne } from './lib/db';
import { llmEmbedding } from './lib/llm';
import { logger } from './lib/logger';
import { redisConnection } from './lib/redis';
import { DEFAULT_EMBEDDING_MODEL, resolveSearchModeStatus } from './lib/search-mode';
import { storage } from './lib/storage';
import { getEmbedQueue } from './queues';
import {
  processAnalyzeJob,
  processEmbedJob,
  type AnalyzeJobDependencies,
  type AnalyzeJobLike,
  type EmbedJobDependencies,
} from './worker-jobs';
import { processImageGenerateJob, type ImageGenerateJobDependencies, type ImageGenerateJobLike } from './worker-image-jobs';

function createAnalyzeJobDependencies(): AnalyzeJobDependencies {
  return {
    query,
    queryOne,
    analyzeText,
    analyzeImage,
    storage,
    embedQueue: getEmbedQueue(),
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

function createImageGenerateJobDependencies(): ImageGenerateJobDependencies {
  return {
    getImageJobSnapshot: imageGenerationRepository.getImageJobSnapshot,
    getPlanExecutionPages: imageGenerationRepository.getPlanExecutionPages,
    updateImageJob: imageGenerationRepository.updateImageJob,
    appendImageJobEvent: imageGenerationRepository.appendImageJobEvent,
    createImageAsset: imageGenerationRepository.createImageAsset,
    selectImageAsset: imageGenerationRepository.selectImageAsset,
    generateImages: generatePlannedImages,
    storage,
    logger,
  };
}

export let analyzeWorker: Worker<{ sampleId: string }> | undefined;
export let embedWorker: Worker<{ sampleId: string }> | undefined;
export let imageGenerateWorker: Worker<{ jobId: string }> | undefined;

export function startWorkers(): {
  analyzeWorker: Worker<{ sampleId: string }>;
  embedWorker: Worker<{ sampleId: string }>;
  imageGenerateWorker: Worker<{ jobId: string }>;
} {
  if (analyzeWorker && embedWorker && imageGenerateWorker) {
    return { analyzeWorker, embedWorker, imageGenerateWorker };
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

  imageGenerateWorker = new Worker<{ jobId: string }>(
    'image-generate',
    async (job) => {
      try {
        await processImageGenerateJob(job as ImageGenerateJobLike, createImageGenerateJobDependencies());
      } catch (error) {
        logger.error({ error, job: job.id, imageJobId: job.data.jobId }, 'Image generation job failed');
        throw error;
      }
    },
    { connection: redisConnection },
  );

  logger.info('Workers started');

  return { analyzeWorker, embedWorker, imageGenerateWorker };
}

function isExecutedDirectly(): boolean {
  const entryPath = process.argv[1];
  return typeof entryPath === 'string' && import.meta.url === pathToFileURL(entryPath).href;
}

if (isExecutedDirectly()) {
  startWorkers();
}
