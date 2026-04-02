import { Queue } from 'bullmq';
import { redisConnection } from '@/lib/redis';

let analyzeQueue: Queue<{ sampleId: string }> | undefined;
let embedQueue: Queue<{ sampleId: string }> | undefined;
let imageGenerateQueue: Queue<{ jobId: string }> | undefined;

export function getAnalyzeQueue(): Queue<{ sampleId: string }> {
  analyzeQueue ??= new Queue('sample-analyze', {
    connection: redisConnection,
  });

  return analyzeQueue;
}

export function getEmbedQueue(): Queue<{ sampleId: string }> {
  embedQueue ??= new Queue('sample-embed', {
    connection: redisConnection,
  });

  return embedQueue;
}

export function getImageGenerateQueue(): Queue<{ jobId: string }> {
  imageGenerateQueue ??= new Queue('image-generate', {
    connection: redisConnection,
  });

  return imageGenerateQueue;
}

export async function enqueueImageGenerateJob(jobId: string): Promise<void> {
  await getImageGenerateQueue().add('generate', { jobId });
}
