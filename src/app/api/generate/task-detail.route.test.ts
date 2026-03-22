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
        outputs: { titles: ['标题一'] },
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
    outputs: { titles: ['标题一'] },
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
