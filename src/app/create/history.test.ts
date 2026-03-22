import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildHistoryTaskHref,
  fetchHistoryTaskDetail,
  fetchHistoryTasks,
  normalizeHistoryTaskId,
} from './history';

test('fetchHistoryTasks loads recent generation tasks from the existing history endpoint', async () => {
  const tasks = await fetchHistoryTasks(async (input) => {
    assert.equal(input, '/api/generate/history?page=1&limit=8');
    return new Response(JSON.stringify({
      tasks: [
        {
          id: 'task-1',
          topic: '历史任务一',
          status: 'completed',
          reference_mode: 'referenced',
          created_at: '2026-03-22T10:00:00.000Z',
        },
      ],
      total: 1,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]?.id, 'task-1');
});

test('fetchHistoryTaskDetail loads the selected task detail from the existing detail endpoint', async () => {
  const detail = await fetchHistoryTaskDetail('task-1', async (input) => {
    assert.equal(input, '/api/generate/task-1');
    return new Response(JSON.stringify({
      task: { id: 'task-1', topic: '历史任务一', status: 'completed' },
      strategy: { strategy_summary: '策略摘要' },
      references: [{ sample_id: 'sample-1', title: '参考样本' }],
      outputs: null,
      reference_mode: 'referenced',
      feedback: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  assert.equal(detail.task.id, 'task-1');
  assert.equal(detail.references[0]?.title, '参考样本');
});

test('normalizeHistoryTaskId and buildHistoryTaskHref support deep-linking into /create', () => {
  assert.equal(normalizeHistoryTaskId(' task-1 '), 'task-1');
  assert.equal(normalizeHistoryTaskId('   '), null);
  assert.equal(buildHistoryTaskHref('task-1'), '/create?taskId=task-1');
});
