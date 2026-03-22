import assert from 'node:assert/strict';
import test from 'node:test';

import { createStorageFromEnv } from './storage';

test('createStorageFromEnv returns local storage for local provider', () => {
  const storage = createStorageFromEnv({
    STORAGE_PROVIDER: 'local',
    STORAGE_LOCAL_PATH: '/tmp/xhs-pilot-uploads',
  });

  assert.equal(typeof storage.getUrl, 'function');
  assert.equal(storage.getUrl('samples/cover.png'), '/uploads/samples/cover.png');
});

test('createStorageFromEnv rejects unsupported storage providers in phase 6', () => {
  assert.throws(
    () =>
      createStorageFromEnv({
        STORAGE_PROVIDER: 's3',
        STORAGE_LOCAL_PATH: '/tmp/xhs-pilot-uploads',
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === 'Unsupported STORAGE_PROVIDER "s3". Phase 6 only supports local storage.',
  );
});
