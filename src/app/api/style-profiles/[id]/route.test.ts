import assert from 'node:assert/strict';
import test from 'node:test';

import { createStyleProfilePatchHandler } from './route';

test('PATCH /api/style-profiles/[id] updates name and description', async () => {
  const PATCH = createStyleProfilePatchHandler({
    updateStyleProfile: async (id, input) => {
      assert.equal(id, 'profile-1');
      assert.deepEqual(input, { name: '新名称', description: '新描述' });
      return {
        profile: {
          id,
          name: input.name,
          description: input.description,
          sample_count: 1,
          typical_tags: ['职场'],
        },
      };
    },
  });

  const response = await PATCH(
    new Request('http://localhost/api/style-profiles/profile-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '新名称', description: '新描述' }),
    }),
    { params: Promise.resolve({ id: 'profile-1' }) },
  );

  assert.deepEqual(await response.json(), {
    profile: {
      id: 'profile-1',
      name: '新名称',
      description: '新描述',
      sample_count: 1,
      typical_tags: ['职场'],
    },
  });
});

test('PATCH /api/style-profiles/[id] returns 404 when the profile is missing', async () => {
  const PATCH = createStyleProfilePatchHandler({
    updateStyleProfile: async () => null,
  });

  const response = await PATCH(
    new Request('http://localhost/api/style-profiles/missing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '新名称' }),
    }),
    { params: Promise.resolve({ id: 'missing' }) },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Style profile not found' });
});
