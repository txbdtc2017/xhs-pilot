import assert from 'node:assert/strict';
import test from 'node:test';
import { backfillMissingEmbeddings } from './embedding-backfill';

test('backfillMissingEmbeddings rejects non-hybrid search modes', async () => {
  await assert.rejects(
    backfillMissingEmbeddings({
      query: async () => [],
      enqueueEmbeddingJob: async () => undefined,
      getSearchModeStatus: () => ({
        searchMode: 'lexical-only',
        searchModeReason: 'EMBEDDING_* 未完整配置，已切换到 lexical-only 检索。',
        embeddingModel: 'text-embedding-3-small',
      }),
    }),
    /lexical-only/,
  );
});

test('backfillMissingEmbeddings queues only samples without embeddings in hybrid mode', async () => {
  const queuedSampleIds: string[] = [];

  const result = await backfillMissingEmbeddings({
    query: async () => [{ sample_id: 'sample-1' }, { sample_id: 'sample-2' }],
    enqueueEmbeddingJob: async (sampleId) => {
      queuedSampleIds.push(sampleId);
      return undefined;
    },
    getSearchModeStatus: () => ({
      searchMode: 'hybrid',
      searchModeReason: null,
      embeddingModel: 'text-embedding-3-small',
    }),
  });

  assert.deepEqual(queuedSampleIds, ['sample-1', 'sample-2']);
  assert.deepEqual(result, { queued: 2 });
});
