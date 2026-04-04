import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCreateImagesHref,
  buildCreatePublishHref,
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
  const detail = await fetchHistoryTaskDetail('task-1', null, async (input) => {
    assert.equal(input, '/api/generate/task-1');
    return new Response(JSON.stringify({
      task: { id: 'task-1', topic: '历史任务一', status: 'completed' },
      runtime: {
        lifecycle_state: 'completed',
        current_step: 'persisting',
        started_at: '2026-03-31T00:00:00.000Z',
        last_progress_at: '2026-03-31T00:00:09.000Z',
        last_heartbeat_at: '2026-03-31T00:00:09.000Z',
        stalled_at: null,
        failed_at: null,
        stalled_reason: null,
        failure_reason: null,
      },
      strategy: { strategy_summary: '策略摘要' },
      references: [{ sample_id: 'sample-1', title: '参考样本' }],
      output_versions: [],
      selected_output_id: null,
      outputs: null,
      latest_image_plan: null,
      active_image_job: null,
      reference_mode: 'referenced',
      feedback: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  assert.equal(detail.task.id, 'task-1');
  assert.equal(detail.runtime.lifecycle_state, 'completed');
  assert.equal(detail.references[0]?.title, '参考样本');
});

test('fetchHistoryTaskDetail forwards the selected output id when switching history versions', async () => {
  await fetchHistoryTaskDetail('task-1', 'output-2', async (input) => {
    assert.equal(input, '/api/generate/task-1?outputId=output-2');
    return new Response(JSON.stringify({
      task: { id: 'task-1', topic: '历史任务一', status: 'completed' },
      runtime: {
        lifecycle_state: 'completed',
        current_step: 'persisting',
        started_at: '2026-03-31T00:00:00.000Z',
        last_progress_at: '2026-03-31T00:00:09.000Z',
        last_heartbeat_at: '2026-03-31T00:00:09.000Z',
        stalled_at: null,
        failed_at: null,
        stalled_reason: null,
        failure_reason: null,
      },
      strategy: null,
      references: [],
      output_versions: [],
      selected_output_id: 'output-2',
      outputs: null,
      latest_image_plan: null,
      active_image_job: null,
      reference_mode: 'referenced',
      feedback: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
});

test('normalizeHistoryTaskId and buildHistoryTaskHref support deep-linking into /history', () => {
  assert.equal(normalizeHistoryTaskId(' task-1 '), 'task-1');
  assert.equal(normalizeHistoryTaskId('   '), null);
  assert.equal(buildHistoryTaskHref('task-1'), '/history?taskId=task-1');
});

test('buildCreateImagesHref and buildCreatePublishHref preserve task and output context', () => {
  assert.equal(buildCreateImagesHref(), '/create/images');
  assert.equal(buildCreateImagesHref('task-1'), '/create/images?taskId=task-1');
  assert.equal(
    buildCreateImagesHref('task-1', 'output-2'),
    '/create/images?taskId=task-1&outputId=output-2',
  );

  assert.equal(buildCreatePublishHref(), '/create/publish');
  assert.equal(buildCreatePublishHref('task-1'), '/create/publish?taskId=task-1');
  assert.equal(
    buildCreatePublishHref('task-1', 'output-2'),
    '/create/publish?taskId=task-1&outputId=output-2',
  );
});
