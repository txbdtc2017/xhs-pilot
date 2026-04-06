import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyHistoryTaskDeletion,
  createInitialHistoryDeleteState,
  reduceHistoryDeleteState,
} from './delete-flow';

test('delete flow opens the confirmation modal immediately when a row delete action is triggered', () => {
  let state = createInitialHistoryDeleteState();

  state = reduceHistoryDeleteState(state, {
    type: 'delete_modal_opened',
    taskId: 'task-2',
  });

  assert.equal(state.modalTaskId, 'task-2');
  assert.equal(state.pendingTaskId, null);
});

test('applyHistoryTaskDeletion selects the next remaining task after deleting the current selection', () => {
  const result = applyHistoryTaskDeletion({
    tasks: [
      {
        id: 'task-1',
        topic: '任务一',
        status: 'completed',
        reference_mode: 'referenced',
        created_at: '2026-04-04T08:00:00.000Z',
        can_delete: true,
      },
      {
        id: 'task-2',
        topic: '任务二',
        status: 'completed',
        reference_mode: 'referenced',
        created_at: '2026-04-04T08:01:00.000Z',
        can_delete: true,
      },
      {
        id: 'task-3',
        topic: '任务三',
        status: 'failed',
        reference_mode: 'zero-shot',
        created_at: '2026-04-04T08:02:00.000Z',
        can_delete: true,
      },
    ],
    selectedTaskId: 'task-2',
    deletedTaskId: 'task-2',
  });

  assert.deepEqual(result.tasks.map((task) => task.id), ['task-1', 'task-3']);
  assert.equal(result.nextSelectedTaskId, 'task-3');
});

test('applyHistoryTaskDeletion falls back to the empty state when the last task is removed', () => {
  const result = applyHistoryTaskDeletion({
    tasks: [
      {
        id: 'task-1',
        topic: '任务一',
        status: 'completed',
        reference_mode: 'referenced',
        created_at: '2026-04-04T08:00:00.000Z',
        can_delete: true,
      },
    ],
    selectedTaskId: 'task-1',
    deletedTaskId: 'task-1',
  });

  assert.deepEqual(result.tasks, []);
  assert.equal(result.nextSelectedTaskId, null);
});
