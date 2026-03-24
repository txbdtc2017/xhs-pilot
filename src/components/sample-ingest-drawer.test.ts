import assert from 'node:assert/strict';
import test from 'node:test';

import * as sampleIngestDrawerModule from './sample-ingest-drawer';

test('lockBodyScroll hides overflow and restores the previous body overflow value', () => {
  assert.equal(typeof sampleIngestDrawerModule.lockBodyScroll, 'function');

  const fakeDocument = {
    body: {
      style: {
        overflow: 'auto',
      },
    },
  } as Document;

  const unlock = sampleIngestDrawerModule.lockBodyScroll(fakeDocument);
  assert.equal(fakeDocument.body.style.overflow, 'hidden');

  unlock();
  assert.equal(fakeDocument.body.style.overflow, 'auto');
});

test('lockBodyScroll returns a safe cleanup function when document.body is missing', () => {
  assert.equal(typeof sampleIngestDrawerModule.lockBodyScroll, 'function');

  const unlock = sampleIngestDrawerModule.lockBodyScroll({} as Document);
  assert.doesNotThrow(() => unlock());
});
