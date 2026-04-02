import assert from 'node:assert/strict';
import test from 'node:test';

import { createSseParser } from '@/lib/sse';
import { createImageJobEventsGetHandler } from './route';

async function readEvents(response: Response) {
  const text = await response.text();
  const events: Array<{ event: string; data: unknown }> = [];
  const parser = createSseParser((event) => {
    events.push(event);
  });

  parser.push(text);
  parser.flush();
  return events;
}

test('GET /api/image-jobs/[jobId]/events replays stored events before closing terminal jobs', async () => {
  const GET = createImageJobEventsGetHandler({
    getImageJobSnapshot: async () => ({
      job: {
        id: 'job-1',
        plan_id: 'plan-1',
        scope: 'full',
        plan_page_id: null,
        status: 'completed',
        total_units: 1,
        completed_units: 1,
        error_message: null,
        model_name: 'gpt-image-1',
        created_at: '2026-03-31T00:00:00.000Z',
        started_at: '2026-03-31T00:00:01.000Z',
        finished_at: '2026-03-31T00:00:05.000Z',
      },
      plan: {
        id: 'plan-1',
        output_id: 'output-1',
        status: 'ready',
      },
      pages: [],
      assets: [],
      selected_assets: [],
    }),
    listImageJobEvents: async (jobId, afterId) => {
      assert.equal(jobId, 'job-1');
      assert.equal(afterId, undefined);
      return [
        {
          id: 1,
          job_id: 'job-1',
          event_name: 'job_queued',
          payload: { job_id: 'job-1', scope: 'full' },
          created_at: '2026-03-31T00:00:00.000Z',
        },
        {
          id: 2,
          job_id: 'job-1',
          event_name: 'job_completed',
          payload: { job_id: 'job-1', status: 'completed' },
          created_at: '2026-03-31T00:00:05.000Z',
        },
      ];
    },
    pollIntervalMs: 1,
  });

  const response = await GET(
    new Request('http://localhost/api/image-jobs/job-1/events'),
    { params: Promise.resolve({ jobId: 'job-1' }) },
  );

  const events = await readEvents(response);
  assert.deepEqual(events, [
    { event: 'job_queued', data: { job_id: 'job-1', scope: 'full' } },
    { event: 'job_completed', data: { job_id: 'job-1', status: 'completed' } },
  ]);
});
