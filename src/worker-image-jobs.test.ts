import assert from 'node:assert/strict';
import test from 'node:test';

import { processImageGenerateJob, type ImageGenerateJobDependencies } from './worker-image-jobs';

function createBaseDependencies(): {
  dependencies: ImageGenerateJobDependencies;
  events: Array<{ eventName: string; payload: Record<string, unknown> }>;
  updates: Array<Record<string, unknown>>;
  uploads: Array<{ key: string; size: number }>;
  createdAssets: Array<Record<string, unknown>>;
  selectedAssetIds: string[];
  prompts: string[];
} {
  const events: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
  const updates: Array<Record<string, unknown>> = [];
  const uploads: Array<{ key: string; size: number }> = [];
  const createdAssets: Array<Record<string, unknown>> = [];
  const selectedAssetIds: string[] = [];
  const prompts: string[] = [];

  const dependencies: ImageGenerateJobDependencies = {
    appendImageJobEvent: async (_jobId, eventName, payload) => {
      events.push({ eventName, payload });
      return {
        id: events.length,
        job_id: 'job-1',
        event_name: eventName,
        payload,
        created_at: '2026-03-31T00:00:00.000Z',
      };
    },
    createImageAsset: async (input) => {
      createdAssets.push(input as unknown as Record<string, unknown>);
      return {
        id: `asset-${createdAssets.length}`,
        plan_page_id: input.planPageId,
        job_id: input.jobId,
        image_url: input.imageUrl,
        candidate_index: input.candidateIndex,
        is_selected: Boolean(input.isSelected),
      };
    },
    generateImages: async ({ promptText, candidateCount, provider, modelName }) => {
      prompts.push(promptText);
      assert.equal(provider, 'openai');
      assert.equal(modelName, 'gpt-image-1');
      return Array.from({ length: candidateCount }, (_, index) => ({
        data: Buffer.from(`${promptText}-${index}`),
        mimeType: 'image/png',
        width: 1024,
        height: 1536,
      }));
    },
    getImageJobSnapshot: async () => ({
      job: {
        id: 'job-1',
        plan_id: 'plan-1',
        scope: 'full',
        plan_page_id: null,
        status: 'queued',
        total_units: 0,
        completed_units: 0,
        error_message: null,
        provider: 'openai',
        model_name: 'gpt-image-1',
        created_at: '2026-03-31T00:00:00.000Z',
        started_at: null,
        finished_at: null,
      },
      plan: {
        id: 'plan-1',
        output_id: 'output-1',
        status: 'ready',
        provider: 'openai',
        provider_model: 'gpt-image-1',
      },
      pages: [],
      assets: [],
      selected_assets: [],
    }),
    getPlanExecutionPages: async () => [
      {
        page: {
          id: 'page-cover',
          plan_id: 'plan-1',
          sort_order: 0,
          page_role: 'cover',
          is_enabled: true,
          content_purpose: '封面结论页',
          source_excerpt: '封面主标题',
          visual_type: 'info-card',
          style_reason: '高对比大字',
          prompt_summary: '封面摘要',
          prompt_text: 'cover prompt',
          candidate_count: 2,
        },
        selected_assets: [],
      },
      {
        page: {
          id: 'page-body',
          plan_id: 'plan-1',
          sort_order: 1,
          page_role: 'body',
          is_enabled: true,
          content_purpose: '正文要点页',
          source_excerpt: '正文第一段',
          visual_type: 'info-card',
          style_reason: '信息卡',
          prompt_summary: '正文摘要',
          prompt_text: 'body prompt',
          candidate_count: 1,
        },
        selected_assets: [
          {
            id: 'existing-selected',
            plan_page_id: 'page-body',
            image_url: '/uploads/existing.png',
            candidate_index: 0,
            is_selected: true,
          },
        ],
      },
    ],
    logger: {
      error: (...args: unknown[]) => args,
      info: (...args: unknown[]) => args,
      warn: (...args: unknown[]) => args,
    },
    now: () => new Date('2026-03-31T00:00:00.000Z'),
    selectImageAsset: async (assetId) => {
      selectedAssetIds.push(assetId);
      return {
        id: assetId,
        plan_page_id: 'page-cover',
        image_url: `/uploads/${assetId}.png`,
        is_selected: true,
      };
    },
    storage: {
      upload: async (file, key) => {
        uploads.push({ key, size: file.length });
        return `/uploads/${key}`;
      },
    },
    updateImageJob: async (_jobId, patch) => {
      updates.push(patch as Record<string, unknown>);
    },
  };

  return {
    dependencies,
    events,
    updates,
    uploads,
    createdAssets,
    selectedAssetIds,
    prompts,
  };
}

test('processImageGenerateJob stores generated assets, auto-selects the first image for new pages, and completes the job', async () => {
  const {
    dependencies,
    events,
    updates,
    uploads,
    createdAssets,
    selectedAssetIds,
    prompts,
  } = createBaseDependencies();

  await processImageGenerateJob({ data: { jobId: 'job-1' } }, dependencies);

  assert.deepEqual(prompts, ['cover prompt', 'body prompt']);
  assert.equal(createdAssets.length, 3);
  assert.equal(uploads.length, 3);
  assert.equal(selectedAssetIds.length, 1);
  assert.equal(selectedAssetIds[0], 'asset-1');
  assert.deepEqual(updates[0], {
    status: 'running',
    total_units: 3,
    completed_units: 0,
    started_at: '2026-03-31T00:00:00.000Z',
  });
  assert.deepEqual(updates.at(-1), {
    status: 'completed',
    completed_units: 3,
    finished_at: '2026-03-31T00:00:00.000Z',
  });
  assert.deepEqual(
    events.map((entry) => entry.eventName),
    [
      'job_started',
      'page_started',
      'asset_generated',
      'asset_generated',
      'page_completed',
      'page_started',
      'asset_generated',
      'page_completed',
      'job_completed',
    ],
  );
  const firstAssetPayload = events.find((entry) => entry.eventName === 'asset_generated')?.payload
    .asset as { is_selected?: boolean } | undefined;
  assert.equal(
    firstAssetPayload?.is_selected,
    true,
  );
});

test('processImageGenerateJob marks the job as partial_failed when generation breaks after partial progress', async () => {
  const { dependencies, events, updates, selectedAssetIds } = createBaseDependencies();
  let invocationCount = 0;

  dependencies.generateImages = async ({ promptText, candidateCount, provider, modelName }) => {
    invocationCount += 1;
    assert.equal(provider, 'openai');
    assert.equal(modelName, 'gpt-image-1');
    if (invocationCount === 2) {
      throw new Error('provider timeout');
    }

    return Array.from({ length: candidateCount }, (_, index) => ({
      data: Buffer.from(`${promptText}-${index}`),
      mimeType: 'image/png',
      width: 1024,
      height: 1536,
    }));
  };

  await assert.rejects(
    processImageGenerateJob({ data: { jobId: 'job-1' } }, dependencies),
    /provider timeout/,
  );

  assert.equal(selectedAssetIds.length, 1);
  assert.deepEqual(updates.at(-1), {
    status: 'partial_failed',
    completed_units: 2,
    error_message: 'provider timeout',
    finished_at: '2026-03-31T00:00:00.000Z',
  });
  assert.equal(events.at(-1)?.eventName, 'job_failed');
  assert.equal(events.at(-1)?.payload.status, 'partial_failed');
});
