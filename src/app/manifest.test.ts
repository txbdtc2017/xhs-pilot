import assert from 'node:assert/strict';
import test from 'node:test';

import manifest from './manifest';

test('app manifest exposes install metadata for the phase 6 PWA shell', () => {
  const result = manifest();

  assert.equal(result.name, 'XHS Pilot');
  assert.equal(result.short_name, 'XHS Pilot');
  assert.equal(result.start_url, '/');
  assert.equal(result.display, 'standalone');
  assert.equal(result.theme_color, '#ff2442');
  assert.equal(result.background_color, '#fff8f1');
  assert.deepEqual(result.icons, [
    {
      src: '/icons/icon-192.svg',
      sizes: '192x192',
      type: 'image/svg+xml',
    },
    {
      src: '/icons/icon-512.svg',
      sizes: '512x512',
      type: 'image/svg+xml',
    },
  ]);
});
