import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createStyleProfilesGetHandler,
  createStyleProfilesPostHandler,
} from './route';

test('GET /api/style-profiles returns profiles', async () => {
  const GET = createStyleProfilesGetHandler({
    listStyleProfiles: async () => ({
      profiles: [
        {
          id: 'profile-1',
          name: '职场清单收藏风',
          description: '偏收藏导向',
          sample_count: 2,
          typical_tags: ['职场', '清单'],
        },
      ],
    }),
  });

  const response = await GET(new Request('http://localhost/api/style-profiles'));

  assert.deepEqual(await response.json(), {
    profiles: [
      {
        id: 'profile-1',
        name: '职场清单收藏风',
        description: '偏收藏导向',
        sample_count: 2,
        typical_tags: ['职场', '清单'],
      },
    ],
  });
});

test('POST /api/style-profiles validates name and creates a profile', async () => {
  const POST = createStyleProfilesPostHandler({
    createStyleProfile: async (input) => {
      assert.deepEqual(input, { name: '职场清单收藏风', description: '偏收藏导向' });
      return {
        profile: {
          id: 'profile-1',
          name: input.name,
          description: input.description,
          sample_count: 0,
          typical_tags: [],
        },
      };
    },
  });

  const response = await POST(
    new Request('http://localhost/api/style-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '职场清单收藏风', description: '偏收藏导向' }),
    }),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    profile: {
      id: 'profile-1',
      name: '职场清单收藏风',
      description: '偏收藏导向',
      sample_count: 0,
      typical_tags: [],
    },
  });
});

test('POST /api/style-profiles rejects empty names', async () => {
  const POST = createStyleProfilesPostHandler({
    createStyleProfile: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await POST(
    new Request('http://localhost/api/style-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'name is required' });
});
