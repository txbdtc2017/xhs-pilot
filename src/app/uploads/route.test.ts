import assert from 'node:assert/strict';
import test from 'node:test';

import { createUploadsGetHandler } from './[...path]/route';

test('GET /uploads/[...path] returns local files with a detected content type and long cache headers', async () => {
  const GET = createUploadsGetHandler({
    resolveUploadPath: (segments) => `/tmp/${segments.join('/')}`,
    readFile: async (resolvedPath) => {
      assert.equal(resolvedPath, '/tmp/samples/1710000000-cover.png');
      return Buffer.from('png-binary');
    },
  });

  const response = await GET(new Request('http://localhost/uploads/samples/1710000000-cover.png'), {
    params: Promise.resolve({ path: ['samples', '1710000000-cover.png'] }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), 'png-binary');
});

test('GET /uploads/[...path] rejects path traversal attempts', async () => {
  const GET = createUploadsGetHandler({
    resolveUploadPath: () => {
      throw new Error('path traversal detected');
    },
    readFile: async () => Buffer.from('should-not-run'),
  });

  const response = await GET(new Request('http://localhost/uploads/../secret.txt'), {
    params: Promise.resolve({ path: ['..', 'secret.txt'] }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'Invalid upload path',
  });
});
