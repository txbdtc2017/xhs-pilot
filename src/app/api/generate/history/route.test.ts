import assert from 'node:assert/strict';
import test from 'node:test';

import { createGenerateHistoryGetHandler } from './route';

test('GET /api/generate/history returns paginated tasks', async () => {
  const GET = createGenerateHistoryGetHandler({
    getTaskHistory: async ({ page, limit }) => {
      assert.equal(page, 2);
      assert.equal(limit, 5);

      return {
        tasks: [
          {
            id: 'task-1',
            topic: '主题一',
            status: 'completed',
            reference_mode: 'referenced',
            created_at: '2026-03-22T00:00:00.000Z',
            can_delete: true,
          },
        ],
        total: 11,
      };
    },
  });

  const response = await GET(new Request('http://localhost/api/generate/history?page=2&limit=5'));
  const payload = await response.json();

  assert.deepEqual(payload, {
    tasks: [
      {
        id: 'task-1',
        topic: '主题一',
        status: 'completed',
        reference_mode: 'referenced',
        created_at: '2026-03-22T00:00:00.000Z',
        can_delete: true,
      },
    ],
    total: 11,
  });
});
