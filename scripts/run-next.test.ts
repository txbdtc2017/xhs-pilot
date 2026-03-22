import assert from 'node:assert/strict';
import test from 'node:test';

import { createNextLaunchConfig } from './run-next';

test('createNextLaunchConfig defaults PORT to 17789 when it is unset', () => {
  const config = createNextLaunchConfig('dev', {
    NODE_ENV: 'development',
  });

  assert.equal(config.command, 'next');
  assert.deepEqual(config.args, ['dev']);
  assert.equal(config.env.PORT, '17789');
});

test('createNextLaunchConfig preserves an explicit PORT value', () => {
  const config = createNextLaunchConfig('start', {
    NODE_ENV: 'production',
    PORT: '3000',
  });

  assert.equal(config.command, 'next');
  assert.deepEqual(config.args, ['start']);
  assert.equal(config.env.PORT, '3000');
});
