import assert from 'node:assert/strict';
import test from 'node:test';

import { createImageAssetSelectPostHandler } from './route';

test('POST /api/image-assets/[assetId]/select returns the selected asset payload', async () => {
  const POST = createImageAssetSelectPostHandler({
    selectImageAsset: async (assetId) => {
      assert.equal(assetId, 'asset-2');
      return {
        id: 'asset-2',
        plan_page_id: 'page-2',
        image_url: '/uploads/generated/asset-2.png',
        is_selected: true,
      };
    },
  });

  const response = await POST(
    new Request('http://localhost/api/image-assets/asset-2/select', { method: 'POST' }),
    { params: Promise.resolve({ assetId: 'asset-2' }) },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    asset: {
      id: 'asset-2',
      plan_page_id: 'page-2',
      image_url: '/uploads/generated/asset-2.png',
      is_selected: true,
    },
  });
});
