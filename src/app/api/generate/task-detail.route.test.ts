import assert from 'node:assert/strict';
import test from 'node:test';

import { createGenerateTaskDetailGetHandler } from './[taskId]/route';

test('GET /api/generate/[taskId] returns the persisted generation detail', async () => {
  const GET = createGenerateTaskDetailGetHandler({
    getTaskDetail: async (taskId) => {
      assert.equal(taskId, 'task-1');
      return {
        task: { id: 'task-1', topic: '主题一', status: 'completed' },
        strategy: { strategy_summary: '策略摘要', cta_strategy: '引导收藏' },
        references: [{ sample_id: 'sample-1', reference_type: 'title' }],
        output_versions: [
          { id: 'output-1', version: 1, model_name: 'gpt-4o', created_at: '2026-03-31T00:00:00.000Z' },
        ],
        selected_output_id: 'output-1',
        outputs: { id: 'output-1', titles: ['标题一'] },
        latest_image_plan: {
          plan: { id: 'plan-1', status: 'ready', provider: 'google_vertex', provider_model: 'gemini-3-pro-image-preview' },
          pages: [],
          assets: [],
          selected_assets: [],
        },
        active_image_job: null,
        reference_mode: 'referenced',
        feedback: null,
      };
    },
  });

  const response = await GET(
    new Request('http://localhost/api/generate/task-1'),
    { params: Promise.resolve({ taskId: 'task-1' }) },
  );
  const payload = await response.json();

  assert.deepEqual(payload, {
    task: { id: 'task-1', topic: '主题一', status: 'completed' },
    strategy: { strategy_summary: '策略摘要', cta_strategy: '引导收藏' },
    references: [{ sample_id: 'sample-1', reference_type: 'title' }],
    output_versions: [
      { id: 'output-1', version: 1, model_name: 'gpt-4o', created_at: '2026-03-31T00:00:00.000Z' },
    ],
    selected_output_id: 'output-1',
    outputs: { id: 'output-1', titles: ['标题一'] },
    latest_image_plan: {
      plan: { id: 'plan-1', status: 'ready', provider: 'google_vertex', provider_model: 'gemini-3-pro-image-preview' },
      pages: [],
      assets: [],
      selected_assets: [],
    },
    active_image_job: null,
    reference_mode: 'referenced',
    feedback: null,
  });
});

test('GET /api/generate/[taskId] returns 404 when task is missing', async () => {
  const GET = createGenerateTaskDetailGetHandler({
    getTaskDetail: async () => null,
  });

  const response = await GET(
    new Request('http://localhost/api/generate/task-missing'),
    { params: Promise.resolve({ taskId: 'task-missing' }) },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: 'Task not found',
  });
});

test('GET /api/generate/[taskId] forwards outputId when requesting a specific history version', async () => {
  const GET = createGenerateTaskDetailGetHandler({
    getTaskDetail: async (taskId, options) => {
      assert.equal(taskId, 'task-1');
      assert.deepEqual(options, { selectedOutputId: 'output-2' });
      return {
        task: { id: 'task-1', topic: '主题一', status: 'completed' },
        strategy: null,
        references: [],
        output_versions: [],
        selected_output_id: 'output-2',
        outputs: null,
        latest_image_plan: null,
        active_image_job: null,
        reference_mode: 'referenced',
        feedback: null,
      };
    },
  });

  const response = await GET(
    new Request('http://localhost/api/generate/task-1?outputId=output-2'),
    { params: Promise.resolve({ taskId: 'task-1' }) },
  );

  assert.equal(response.status, 200);
});
