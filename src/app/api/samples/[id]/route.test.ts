import assert from 'node:assert/strict';
import test from 'node:test';

import * as sampleRoute from './route';

const {
  createSampleDeleteHandler,
  createSampleDetailGetHandler,
  createSamplePatchHandler,
} = sampleRoute;

test('GET /api/samples/[id] returns sample details with relationship data', async () => {
  const GET = createSampleDetailGetHandler({
    getSampleDetail: async (id) => {
      assert.equal(id, 'sample-1');
      return {
        sample: { id, title: '标题' },
        analysis: { track: '职场' },
        visualAnalysis: { cover_style_tag: '高对比大字' },
        images: [{ id: 'image-1', image_url: '/cover.png' }],
        related_samples: [{ id: 'sample-2', title: '相似样本' }],
        referenced_by_tasks: [{ task_id: 'task-1', topic: '生成任务' }],
        style_profiles: [{ id: 'profile-1', name: '职场清单收藏风' }],
      };
    },
  });

  const response = await GET(
    new Request('http://localhost/api/samples/sample-1'),
    { params: Promise.resolve({ id: 'sample-1' }) },
  );

  assert.deepEqual(await response.json(), {
    sample: { id: 'sample-1', title: '标题' },
    analysis: { track: '职场' },
    visualAnalysis: { cover_style_tag: '高对比大字' },
    images: [{ id: 'image-1', image_url: '/cover.png' }],
    related_samples: [{ id: 'sample-2', title: '相似样本' }],
    referenced_by_tasks: [{ task_id: 'task-1', topic: '生成任务' }],
    style_profiles: [{ id: 'profile-1', name: '职场清单收藏风' }],
  });
});

test('PATCH /api/samples/[id] returns 400 when no fields are provided', async () => {
  const PATCH = createSamplePatchHandler({
    updateSample: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await PATCH(
    new Request('http://localhost/api/samples/sample-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ id: 'sample-1' }) },
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'No fields to update' });
});

test('PATCH /api/samples/[id] returns 404 when the sample is missing', async () => {
  const PATCH = createSamplePatchHandler({
    updateSample: async () => null,
  });

  const response = await PATCH(
    new Request('http://localhost/api/samples/sample-missing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manual_notes: '更新备注' }),
    }),
    { params: Promise.resolve({ id: 'sample-missing' }) },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Not found' });
});

test('DELETE /api/samples/[id] soft deletes the sample without removing storage objects', async () => {
  let softDeletedId: string | null = null;
  let touchedStorage = false;
  const DELETE = createSampleDeleteHandler({
    softDeleteSample: async (id: string) => {
      assert.equal(id, 'sample-1');
      softDeletedId = id;
      return { success: true };
    },
    deleteStorageObject: async () => {
      touchedStorage = true;
    },
  } as never);

  const response = await DELETE(
    new Request('http://localhost/api/samples/sample-1', { method: 'DELETE' }),
    { params: Promise.resolve({ id: 'sample-1' }) },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(softDeletedId, 'sample-1');
  assert.equal(touchedStorage, false);
});

test('POST /api/samples/[id]/restore restores a sample from the trash', async () => {
  assert.equal(typeof sampleRoute.createSampleRestoreHandler, 'function');

  const POST = sampleRoute.createSampleRestoreHandler({
    restoreSample: async (id: string) => {
      assert.equal(id, 'sample-1');
      return { success: true };
    },
  } as never);

  const response = await POST(
    new Request('http://localhost/api/samples/sample-1/restore', { method: 'POST' }),
    { params: Promise.resolve({ id: 'sample-1' }) },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
});

test('DELETE /api/samples/[id]/permanent removes storage objects after permanent deletion', async () => {
  assert.equal(typeof sampleRoute.createSamplePermanentDeleteHandler, 'function');

  const deletedKeys: string[] = [];
  const DELETE = sampleRoute.createSamplePermanentDeleteHandler({
    permanentlyDeleteSample: async (id: string) => {
      assert.equal(id, 'sample-1');
      return [{ storage_key: 'sample/cover.png' }, { storage_key: null }, { storage_key: 'sample/body.png' }];
    },
    deleteStorageObject: async (key: string) => {
      deletedKeys.push(key);
    },
  } as never);

  const response = await DELETE(
    new Request('http://localhost/api/samples/sample-1/permanent', { method: 'DELETE' }),
    { params: Promise.resolve({ id: 'sample-1' }) },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.deepEqual(deletedKeys, ['sample/cover.png', 'sample/body.png']);
});
