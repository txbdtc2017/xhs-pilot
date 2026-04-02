import assert from 'node:assert/strict';
import test from 'node:test';

import { createImageJobGetHandler } from './route';

test('GET /api/image-jobs/[jobId] returns the current job snapshot', async () => {
  const GET = createImageJobGetHandler({
    getImageJobSnapshot: async (jobId) => {
      assert.equal(jobId, 'job-1');
      return {
        job: {
          id: 'job-1',
          plan_id: 'plan-1',
          scope: 'full',
          plan_page_id: null,
          status: 'running',
          total_units: 2,
          completed_units: 1,
          error_message: null,
          model_name: 'gpt-image-1',
          created_at: '2026-03-31T00:00:00.000Z',
          started_at: '2026-03-31T00:00:01.000Z',
          finished_at: null,
        },
        plan: {
          id: 'plan-1',
          output_id: 'output-1',
          status: 'ready',
        },
        pages: [
          {
            id: 'page-cover',
            sort_order: 0,
            page_role: 'cover',
            is_enabled: true,
            candidate_count: 2,
          },
        ],
        assets: [],
        selected_assets: [],
      };
    },
  });

  const response = await GET(
    new Request('http://localhost/api/image-jobs/job-1'),
    { params: Promise.resolve({ jobId: 'job-1' }) },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).job.status, 'running');
});
