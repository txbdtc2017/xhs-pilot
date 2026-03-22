import assert from 'node:assert/strict';
import test from 'node:test';

import { createStyleProfileSamplesPostHandler } from './route';

test('POST /api/style-profiles/[id]/samples adds a sample to the profile', async () => {
  const POST = createStyleProfileSamplesPostHandler({
    addSampleToStyleProfile: async (profileId, sampleId) => {
      assert.equal(profileId, 'profile-1');
      assert.equal(sampleId, 'sample-1');
      return { success: true, sample_count: 2 };
    },
  });

  const response = await POST(
    new Request('http://localhost/api/style-profiles/profile-1/samples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sampleId: 'sample-1' }),
    }),
    { params: Promise.resolve({ id: 'profile-1' }) },
  );

  assert.deepEqual(await response.json(), { success: true, sample_count: 2 });
});
