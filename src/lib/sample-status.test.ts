import assert from 'node:assert/strict';
import test from 'node:test';

import { hasActiveSampleStatuses, isActiveSampleStatus } from './sample-status';

test('isActiveSampleStatus returns true only for in-flight sample statuses', () => {
  assert.equal(isActiveSampleStatus('pending'), true);
  assert.equal(isActiveSampleStatus('analyzing'), true);
  assert.equal(isActiveSampleStatus('embedding'), true);
  assert.equal(isActiveSampleStatus('completed'), false);
  assert.equal(isActiveSampleStatus('failed'), false);
  assert.equal(isActiveSampleStatus('unknown'), false);
});

test('hasActiveSampleStatuses returns true when any sample is still processing', () => {
  assert.equal(hasActiveSampleStatuses(['completed', 'pending']), true);
  assert.equal(hasActiveSampleStatuses(['failed', 'completed']), false);
  assert.equal(hasActiveSampleStatuses([]), false);
});
