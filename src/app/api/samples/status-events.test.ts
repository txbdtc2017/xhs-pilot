import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSampleStatusEvent } from './[id]/status/status-events';

test('buildSampleStatusEvent maps active statuses to phase-2 SSE payloads', () => {
  assert.deepEqual(buildSampleStatusEvent({ status: 'pending' }), {
    step: 'queued',
    status: 'pending',
    progress: 0,
  });

  assert.deepEqual(buildSampleStatusEvent({ status: 'analyzing' }), {
    step: 'analysis',
    status: 'analyzing',
    progress: 50,
  });

  assert.deepEqual(buildSampleStatusEvent({ status: 'embedding' }), {
    step: 'embedding',
    status: 'embedding',
    progress: 80,
  });

  assert.deepEqual(buildSampleStatusEvent({ status: 'completed' }), {
    step: 'completed',
    status: 'completed',
    progress: 100,
  });
});

test('buildSampleStatusEvent infers failed step from stored artifacts', () => {
  assert.deepEqual(
    buildSampleStatusEvent({
      status: 'failed',
      hasAnalysis: true,
      hasEmbedding: false,
    }),
    {
      step: 'embedding',
      status: 'failed',
      progress: 80,
    },
  );

  assert.deepEqual(
    buildSampleStatusEvent({
      status: 'failed',
      hasAnalysis: false,
      hasEmbedding: false,
    }),
    {
      step: 'analysis',
      status: 'failed',
      progress: 50,
    },
  );
});
