import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GenerationLifecycleTracker,
  getGenerationStepThresholds,
} from './generation-lifecycle';

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

test('heartbeat alone does not reset the progress timeout', () => {
  const startedAt = '2026-04-04T10:00:00.000Z';
  const thresholds = getGenerationStepThresholds('strategizing');
  const tracker = new GenerationLifecycleTracker({
    currentStep: 'strategizing',
    now: startedAt,
  });

  tracker.recordHeartbeat(addMs(startedAt, thresholds.stallMs - 5_000));
  const evaluation = tracker.evaluate(addMs(startedAt, thresholds.stallMs + 1));

  assert.equal(evaluation.snapshot.lifecycle_state, 'stalled');
  assert.equal(evaluation.snapshot.last_progress_at, startedAt);
  assert.equal(evaluation.snapshot.last_heartbeat_at, addMs(startedAt, thresholds.stallMs - 5_000));
  assert.equal(evaluation.shouldAbort, false);
});

test('meaningful progress resets the quiet and stall windows', () => {
  const startedAt = '2026-04-04T10:00:00.000Z';
  const thresholds = getGenerationStepThresholds('generating');
  const tracker = new GenerationLifecycleTracker({
    currentStep: 'generating',
    now: startedAt,
  });

  const progressAt = addMs(startedAt, thresholds.quietWarningMs + 500);
  tracker.recordProgress({ now: progressAt });
  const evaluation = tracker.evaluate(addMs(progressAt, thresholds.stallMs - 1));

  assert.equal(evaluation.snapshot.lifecycle_state, 'running');
  assert.equal(evaluation.snapshot.last_progress_at, progressAt);
  assert.equal(evaluation.didWarn, true);
});

test('quiet warning is advisory only and does not fail the task', () => {
  const startedAt = '2026-04-04T10:00:00.000Z';
  const thresholds = getGenerationStepThresholds('searching');
  const tracker = new GenerationLifecycleTracker({
    currentStep: 'searching',
    now: startedAt,
  });

  const evaluation = tracker.evaluate(addMs(startedAt, thresholds.quietWarningMs + 1));

  assert.equal(evaluation.didWarn, true);
  assert.equal(evaluation.snapshot.lifecycle_state, 'running');
  assert.equal(evaluation.shouldAbort, false);
});

test('stalled state appears before the task is considered failed', () => {
  const startedAt = '2026-04-04T10:00:00.000Z';
  const thresholds = getGenerationStepThresholds('understanding');
  const tracker = new GenerationLifecycleTracker({
    currentStep: 'understanding',
    now: startedAt,
  });

  const stalledAt = addMs(startedAt, thresholds.stallMs + 1);
  const stalled = tracker.evaluate(stalledAt);
  tracker.recordHeartbeat(addMs(stalledAt, thresholds.deadMs - 1_000));
  const failed = tracker.evaluate(addMs(stalledAt, thresholds.deadMs + 1));

  assert.equal(stalled.snapshot.lifecycle_state, 'stalled');
  assert.equal(stalled.shouldAbort, false);
  assert.equal(failed.snapshot.lifecycle_state, 'failed');
  assert.equal(failed.shouldAbort, true);
  assert.match(failed.snapshot.failure_reason ?? '', /stalled/i);
});

test('missing liveness beyond the dead threshold fails the task', () => {
  const startedAt = '2026-04-04T10:00:00.000Z';
  const thresholds = getGenerationStepThresholds('persisting');
  const tracker = new GenerationLifecycleTracker({
    currentStep: 'persisting',
    now: startedAt,
  });

  const evaluation = tracker.evaluate(addMs(startedAt, thresholds.deadMs + 1));

  assert.equal(evaluation.snapshot.lifecycle_state, 'failed');
  assert.equal(evaluation.shouldAbort, true);
  assert.match(evaluation.snapshot.failure_reason ?? '', /heartbeat/i);
});
