import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('package.json exposes a manual embeddings backfill command', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('./package.json', import.meta.url), 'utf8'),
  ) as {
    scripts?: Record<string, string>;
  };

  assert.equal(typeof packageJson.scripts?.['embeddings:backfill'], 'string');
});
