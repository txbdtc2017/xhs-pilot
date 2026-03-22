import assert from 'node:assert/strict';
import test from 'node:test';

import { createStyleProfileSampleDeleteHandler } from './route';

test('DELETE /api/style-profiles/[id]/samples/[sampleId] removes the sample from the profile', async () => {
  const DELETE = createStyleProfileSampleDeleteHandler({
    removeSampleFromStyleProfile: async (profileId, sampleId) => {
      assert.equal(profileId, 'profile-1');
      assert.equal(sampleId, 'sample-1');
      return { success: true, sample_count: 1 };
    },
  });

  const response = await DELETE(
    new Request('http://localhost/api/style-profiles/profile-1/samples/sample-1', {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ id: 'profile-1', sampleId: 'sample-1' }) },
  );

  assert.deepEqual(await response.json(), { success: true, sample_count: 1 });
});
