import assert from 'node:assert/strict';
import test from 'node:test';

import { processAnalyzeJob, type AnalyzeJobDependencies } from './worker-jobs';

test('processAnalyzeJob continues to embedding when visual analysis fails', async () => {
  const originalEmbeddingApiKey = process.env.EMBEDDING_API_KEY;
  const originalEmbeddingBaseUrl = process.env.EMBEDDING_BASE_URL;
  const originalEmbeddingModel = process.env.EMBEDDING_MODEL;
  process.env.EMBEDDING_API_KEY = 'embed-key';
  process.env.EMBEDDING_BASE_URL = 'https://api.openai.com/v1';
  process.env.EMBEDDING_MODEL = 'text-embedding-3-small';

  const executedQueries: Array<{ text: string; params?: unknown[] }> = [];
  const queuedJobs: Array<{ name: string; data: unknown }> = [];

  const dependencies: AnalyzeJobDependencies = {
    analyzeText: async () => ({
      track: '职场',
      content_type: '清单',
      title_pattern_tags: ['数字型'],
      emotion_level: 5,
      title_pattern_explanation: '标题解释',
      structure_explanation: '结构解释',
      replicable_rules: ['规则'],
      reasoning_summary: '总结',
    }),
    analyzeImage: async () => {
      throw new Error('vision unavailable');
    },
    embedQueue: {
      add: async (name: string, data: unknown) => {
        queuedJobs.push({ name, data });
      },
    },
    logger: {
      error: (...args: unknown[]) => args,
      info: (...args: unknown[]) => args,
      warn: (...args: unknown[]) => args,
    },
    query: async <T>(text: string, params?: unknown[]) => {
      executedQueries.push({ text, params });
      return [] as T[];
    },
    queryOne: async <T>(text: string) => {
      if (text.includes('SELECT title, body_text FROM samples')) {
        return { title: '标题', body_text: '正文' } as T;
      }

      if (text.includes('SELECT storage_key FROM sample_images')) {
        return { storage_key: 'samples/cover.jpg' } as T;
      }

      return null;
    },
    storage: {
      getBuffer: async () => Buffer.from('image'),
    },
  };

  try {
    await processAnalyzeJob({ data: { sampleId: 'sample-1' } }, dependencies);
  } finally {
    process.env.EMBEDDING_API_KEY = originalEmbeddingApiKey;
    process.env.EMBEDDING_BASE_URL = originalEmbeddingBaseUrl;
    process.env.EMBEDDING_MODEL = originalEmbeddingModel;
  }

  assert.equal(
    executedQueries.some(({ text }) => text.includes('INSERT INTO sample_visual_analysis')),
    false,
  );
  assert.equal(
    executedQueries.some(
      ({ text, params }) =>
        text.includes('UPDATE samples SET status = $1 WHERE id = $2') &&
        params?.[0] === 'embedding' &&
        params?.[1] === 'sample-1',
    ),
    true,
  );
  assert.deepEqual(queuedJobs, [{ name: 'embed', data: { sampleId: 'sample-1' } }]);
});

test('processAnalyzeJob completes directly in lexical-only mode when embeddings are not configured', async () => {
  const originalEmbeddingApiKey = process.env.EMBEDDING_API_KEY;
  const originalEmbeddingBaseUrl = process.env.EMBEDDING_BASE_URL;
  const originalEmbeddingModel = process.env.EMBEDDING_MODEL;

  delete process.env.EMBEDDING_API_KEY;
  delete process.env.EMBEDDING_BASE_URL;
  delete process.env.EMBEDDING_MODEL;

  try {
    const executedQueries: Array<{ text: string; params?: unknown[] }> = [];
    const queuedJobs: Array<{ name: string; data: unknown }> = [];

    const dependencies: AnalyzeJobDependencies = {
      analyzeText: async () => ({
        track: '职场',
        content_type: '清单',
        title_pattern_tags: ['数字型'],
        emotion_level: 5,
        title_pattern_explanation: '标题解释',
        structure_explanation: '结构解释',
        replicable_rules: ['规则'],
        reasoning_summary: '总结',
      }),
      analyzeImage: async () => ({
        extracted_text: '封面文案',
        cover_style_tag: '高对比大字',
        layout_type_tag: 'single_focus',
        cover_explanation: '封面解释',
      }),
      embedQueue: {
        add: async (name: string, data: unknown) => {
          queuedJobs.push({ name, data });
        },
      },
      logger: {
        error: (...args: unknown[]) => args,
        info: (...args: unknown[]) => args,
        warn: (...args: unknown[]) => args,
      },
      query: async <T>(text: string, params?: unknown[]) => {
        executedQueries.push({ text, params });
        return [] as T[];
      },
      queryOne: async <T>(text: string) => {
        if (text.includes('SELECT title, body_text FROM samples')) {
          return { title: '标题', body_text: '正文' } as T;
        }

        if (text.includes('SELECT storage_key FROM sample_images')) {
          return { storage_key: 'samples/cover.jpg' } as T;
        }

        return null;
      },
      storage: {
        getBuffer: async () => Buffer.from('image'),
      },
    };

    await processAnalyzeJob({ data: { sampleId: 'sample-lexical' } }, dependencies);

    assert.equal(
      executedQueries.some(
        ({ text, params }) =>
          text.includes('UPDATE samples SET status = $1 WHERE id = $2') &&
          params?.[0] === 'completed' &&
          params?.[1] === 'sample-lexical',
      ),
      true,
    );
    assert.equal(
      executedQueries.some(
        ({ text, params }) =>
          text.includes('UPDATE samples SET status = $1 WHERE id = $2') &&
          params?.[0] === 'embedding' &&
          params?.[1] === 'sample-lexical',
      ),
      false,
    );
    assert.deepEqual(queuedJobs, []);
  } finally {
    process.env.EMBEDDING_API_KEY = originalEmbeddingApiKey;
    process.env.EMBEDDING_BASE_URL = originalEmbeddingBaseUrl;
    process.env.EMBEDDING_MODEL = originalEmbeddingModel;
  }
});
