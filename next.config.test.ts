import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('next.config.js exposes base security headers and a no-cache policy for sw.js', async () => {
  const nextConfig = require('./next.config.js');
  const config = nextConfig.default ?? nextConfig;

  assert.equal(typeof config.headers, 'function');

  const headers = await config.headers();
  const headersBySource = new Map(headers.map((entry: { source: string; headers: Array<{ key: string; value: string }> }) => [entry.source, entry.headers]));

  assert.deepEqual(headersBySource.get('/(.*)'), [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  ]);

  assert.deepEqual(headersBySource.get('/sw.js'), [
    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
    { key: 'Service-Worker-Allowed', value: '/' },
  ]);
});
